-- =====================================================================
-- staff_booking_test.sql  —  book_appointment() for staff (0021 fix).
-- Before 0021 every call failed on the end-time calculation, so this
-- covers the happy path plus the main rejections.
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
create or replace function _assert_raises(p_sql text, p_like text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then raise notice 'ok: %', p_msg; return; end if;
    raise exception 'ASSERT FAILED: % (wrong error: %)', p_msg, sqlerrm;
  end;
  raise exception 'ASSERT FAILED: % (no error raised)', p_msg;
end;
$$;
create or replace function _as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then reset role; else set local role authenticated; end if;
end;
$$;
-- Tomorrow (Manila) at a local wall-clock time, as timestamptz.
create or replace function _tomorrow_at(p_t time) returns timestamptz language sql as $$
  select (((now() at time zone 'Asia/Manila')::date + 1 + p_t) at time zone 'Asia/Manila')
$$;

insert into accounts(id, name) values ('00000000-0000-0000-0000-0000000009a1', 'Staff Booking');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000009ad', 'sb-admin@clinic.test'),
  ('00000000-0000-0000-0000-0000000009d1', 'sb-doc@clinic.test'),
  ('00000000-0000-0000-0000-0000000009e1', 'sb-sec@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000009ad', '00000000-0000-0000-0000-0000000009a1', 'admin',     'SB Admin'),
  ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009a1', 'doctor',    'SB Doc'),
  ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009a1', 'secretary', 'SB Sec')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-0000000009d1');
insert into clinics(id, account_id, name) values
  ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009a1', 'SB Clinic');
insert into doctor_clinics(doctor_id, clinic_id) values
  ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009c1');
-- Every day 09:00–12:00 so "tomorrow" always has hours.
insert into doctor_availability(doctor_id, clinic_id, weekday, start_time, end_time)
select '00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009c1', d, '09:00', '12:00'
from generate_series(0, 6) d;
insert into patients(id, account_id, full_name) values
  ('00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009a1', 'SB Patient');

-- ---- admin books inside availability ----
select _as('00000000-0000-0000-0000-0000000009ad');
select _assert(
  (select scheduled_at from book_appointment(
     '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009d1',
     '00000000-0000-0000-0000-0000000009c1', _tomorrow_at('09:00'), 30)) = _tomorrow_at('09:00'),
  'admin can book a slot inside availability');

-- ---- rejections ----
select _assert_raises($q$ select book_appointment(
     '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009d1',
     '00000000-0000-0000-0000-0000000009c1', _tomorrow_at('09:15'), 30) $q$,
  'double-booked', 'overlapping slot is rejected');
select _assert_raises($q$ select book_appointment(
     '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009d1',
     '00000000-0000-0000-0000-0000000009c1', _tomorrow_at('11:45'), 30) $q$,
  'not available', 'slot running past end of availability is rejected');

-- ---- unassigned secretary can't book for this doctor ----
select _as('00000000-0000-0000-0000-0000000009e1');
select _assert_raises($q$ select book_appointment(
     '00000000-0000-0000-0000-0000000009b1', '00000000-0000-0000-0000-0000000009d1',
     '00000000-0000-0000-0000-0000000009c1', _tomorrow_at('10:00'), 30) $q$,
  'forbidden', 'unassigned secretary is rejected');

select _as(null);
drop function _tomorrow_at(time);
drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid);
rollback;
