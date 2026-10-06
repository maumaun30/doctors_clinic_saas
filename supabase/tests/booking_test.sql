-- =====================================================================
-- booking_test.sql  —  public self-booking RPCs (0016).
-- Fixed uuids, single transaction, rolled back at the end.
-- =====================================================================
begin;
set local role postgres;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'ASSERT FAILED: %', p_msg;
  end if;
  raise notice 'ok: %', p_msg;
end;
$$;

-- Expect `p_sql` to raise; message must contain p_like.
create or replace function _assert_raises(p_sql text, p_like text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then
      raise notice 'ok: %', p_msg;
      return;
    end if;
    raise exception 'ASSERT FAILED: % (wrong error: %)', p_msg, sqlerrm;
  end;
  raise exception 'ASSERT FAILED: % (no error raised)', p_msg;
end;
$$;

insert into accounts(id, name) values ('00000000-0000-0000-0000-0000000003a1', 'Booking Acct');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000003d1', 'bookdoc@test'),
  ('00000000-0000-0000-0000-0000000003d2', 'otherdoc@test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003a1', 'doctor', 'Dr Book'),
  ('00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003a1', 'doctor', 'Dr Elsewhere')
on conflict (id) do update
  set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id, specialization) values
  ('00000000-0000-0000-0000-0000000003d1', 'Pediatrics'),
  ('00000000-0000-0000-0000-0000000003d2', 'GP');
insert into clinics(id, account_id, name, address, online_booking, booking_slug) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003a1', 'Open Clinic', '3 Mabini', true,  'open-clinic'),
  ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-0000000003a1', 'Closed Clinic', null,     false, 'closed-clinic');
insert into doctor_clinics(doctor_id, clinic_id) values
  ('00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003c1'),
  ('00000000-0000-0000-0000-0000000003d2', '00000000-0000-0000-0000-0000000003c2');

-- Dr Book: tomorrow (Manila) 09:00–10:30 at Open Clinic => 3 slots.
insert into doctor_availability(doctor_id, clinic_id, weekday, start_time, end_time)
values ('00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003c1',
        extract(dow from (now() at time zone 'Asia/Manila')::date + 1)::smallint, '09:00', '10:30');

create temp table _t on commit drop as
select ((now() at time zone 'Asia/Manila')::date + 1) as d,
       (((now() at time zone 'Asia/Manila')::date + 1 + time '09:00') at time zone 'Asia/Manila') as s0,
       (((now() at time zone 'Asia/Manila')::date + 1 + time '09:30') at time zone 'Asia/Manila') as s1,
       (((now() at time zone 'Asia/Manila')::date + 1 + time '10:00') at time zone 'Asia/Manila') as s2;
grant select on _t to authenticated;

-- ---- info ----
select _assert((select clinic_name from public_booking_info('open-clinic')) = 'Open Clinic', 'info: enabled clinic found');
select _assert((select clinic_name from public_booking_info('OPEN-CLINIC')) = 'Open Clinic', 'info: slug is case-insensitive');
select _assert(not exists(select 1 from public_booking_info('closed-clinic')), 'info: disabled clinic hidden');
select _assert(not exists(select 1 from public_booking_info('nope')), 'info: unknown slug hidden');
select _assert(
  (select doctors->0->>'name' from public_booking_info('open-clinic')) = 'Dr Book'
  and (select jsonb_array_length(doctors) from public_booking_info('open-clinic')) = 1,
  'info: lists only doctors at that clinic');

-- ---- slots ----
select _assert((select count(*) from public_available_slots('open-clinic', '00000000-0000-0000-0000-0000000003d1', (select d from _t))) = 3,
  'slots: three 30-min slots tomorrow');
select _assert((select count(*) from public_available_slots('closed-clinic', '00000000-0000-0000-0000-0000000003d2', (select d from _t))) = 0,
  'slots: none for disabled clinic');
select _assert((select count(*) from public_available_slots('open-clinic', '00000000-0000-0000-0000-0000000003d2', (select d from _t))) = 0,
  'slots: none for doctor not at clinic');
select _assert((select count(*) from public_available_slots('open-clinic', '00000000-0000-0000-0000-0000000003d1', (select d from _t) + 61)) = 0,
  'slots: none beyond 60 days');

-- ---- permissions ----
set local role authenticated;
select _assert_raises($q$ select * from public_booking_info('open-clinic') $q$, 'permission denied', 'authenticated cannot call public_booking_info');
select _assert_raises($q$ select * from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1', now(), 'X', '0917') $q$,
  'permission denied', 'authenticated cannot call public_book_appointment');
set local role anon;
select _assert_raises($q$ select * from public_available_slots('open-clinic', '00000000-0000-0000-0000-0000000003d1', current_date) $q$,
  'permission denied', 'anon cannot call public_available_slots');
reset role;

-- ---- booking ----
select _assert(
  (select scheduled_at from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
     (select s0 from _t), '  Maria Clara ', '0917 123 4567', 'Maria@Example.com', null, 'ip-a')) = (select s0 from _t),
  'book: first slot booked');
select _assert(
  (select source = 'online' and status = 'scheduled' and duration_minutes = 30
     from appointments where clinic_id = '00000000-0000-0000-0000-0000000003c1' and scheduled_at = (select s0 from _t)),
  'book: appointment is online + scheduled + 30 min');
select _assert(
  (select full_name = 'Maria Clara' and email = 'maria@example.com' from patients
    where account_id = '00000000-0000-0000-0000-0000000003a1'),
  'book: new patient created with trimmed name + lowercased email');
select _assert(
  exists(select 1 from patient_clinics pc join patients p on p.id = pc.patient_id
          where p.full_name = 'Maria Clara' and pc.clinic_id = '00000000-0000-0000-0000-0000000003c1'),
  'book: patient linked to clinic');
select _assert((select count(*) from public_available_slots('open-clinic', '00000000-0000-0000-0000-0000000003d1', (select d from _t))) = 2,
  'book: booked slot no longer offered');

select _assert_raises($q$ select * from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s0 from _t), 'Someone Else', '0918 000 0000') $q$, 'no longer available', 'book: taken slot rejected');
select _assert_raises($q$ select * from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s0 from _t) + interval '5 minutes', 'Someone Else', '0918 000 0000') $q$, 'no longer available', 'book: off-grid time rejected');
select _assert_raises($q$ select * from public_book_appointment('closed-clinic', '00000000-0000-0000-0000-0000000003d2',
  (select s0 from _t), 'Someone Else', '0918 000 0000') $q$, 'not available for this clinic', 'book: disabled clinic rejected');
select _assert_raises($q$ select * from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s1 from _t), 'Someone Else', '12') $q$, 'valid phone', 'book: bad phone rejected');
select _assert_raises($q$ select * from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s1 from _t), ' ', '0918 000 0000') $q$, 'full name', 'book: blank name rejected');

-- Same name + same phone (different formatting) => same patient.
select public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s1 from _t), 'maria clara', '(0917) 123-4567', null, null, 'ip-a');
select _assert(
  (select count(*) from patients where account_id = '00000000-0000-0000-0000-0000000003a1') = 1,
  'book: returning patient matched by name + phone digits');
select _assert_raises($q$ select * from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s2 from _t), 'Maria Clara', '0917 123 4567') $q$, 'already have upcoming', 'book: max 2 upcoming online bookings per patient');

-- Same phone, different name => new patient (no takeover of records).
select public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s2 from _t), 'Juan Dela Cruz', '0917 123 4567', null, null, 'ip-b');
select _assert(
  (select count(*) from patients where account_id = '00000000-0000-0000-0000-0000000003a1') = 2,
  'book: phone match with different name creates a new patient');

-- Rate limit: 5 per IP hash per clinic per hour.
insert into online_booking_attempts(clinic_id, ip_hash)
select '00000000-0000-0000-0000-0000000003c1', 'ip-spam' from generate_series(1, 5);
update appointments set status = 'cancelled' where clinic_id = '00000000-0000-0000-0000-0000000003c1';
select _assert_raises($q$ select * from public_book_appointment('open-clinic', '00000000-0000-0000-0000-0000000003d1',
  (select s0 from _t), 'Spammer', '0999 999 9999', null, null, 'ip-spam') $q$, 'too many bookings', 'book: rate limited per IP');

drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
rollback;
