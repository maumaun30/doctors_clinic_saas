-- =====================================================================
-- patient_self_service_test.sql  —  confirm / cancel links (0032).
-- =====================================================================
begin;
set local role postgres;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'ASSERT FAILED: %', p_msg; end if;
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

insert into accounts(id, name) values ('00000000-0000-0000-0000-00000000f5a1', 'Self Service');
insert into auth.users(id, email) values ('00000000-0000-0000-0000-00000000f5d1', 'ss-doc@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-00000000f5d1', '00000000-0000-0000-0000-00000000f5a1', 'doctor', 'Dr. Self Service')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-00000000f5d1') on conflict do nothing;
insert into clinics(id, account_id, name, address) values
  ('00000000-0000-0000-0000-00000000f5c1', '00000000-0000-0000-0000-00000000f5a1', 'SS Clinic', '9 Main St');
insert into patients(id, account_id, full_name) values
  ('00000000-0000-0000-0000-00000000f5f1', '00000000-0000-0000-0000-00000000f5a1', 'Lourdes Garcia Reyes');
insert into appointments(id, patient_id, doctor_id, clinic_id, scheduled_at, status) values
  ('00000000-0000-0000-0000-00000000f511', '00000000-0000-0000-0000-00000000f5f1', '00000000-0000-0000-0000-00000000f5d1',
   '00000000-0000-0000-0000-00000000f5c1', now() + interval '1 day', 'scheduled'),
  ('00000000-0000-0000-0000-00000000f512', '00000000-0000-0000-0000-00000000f5f1', '00000000-0000-0000-0000-00000000f5d1',
   '00000000-0000-0000-0000-00000000f5c1', now() + interval '1 hour', 'confirmed'),
  ('00000000-0000-0000-0000-00000000f513', '00000000-0000-0000-0000-00000000f5f1', '00000000-0000-0000-0000-00000000f5d1',
   '00000000-0000-0000-0000-00000000f5c1', now() - interval '1 day', 'completed');

select set_config('test.t1', (select patient_token from appointments where id = '00000000-0000-0000-0000-00000000f511'), true),
       set_config('test.t2', (select patient_token from appointments where id = '00000000-0000-0000-0000-00000000f512'), true),
       set_config('test.t3', (select patient_token from appointments where id = '00000000-0000-0000-0000-00000000f513'), true);

select _assert(current_setting('test.t1') ~ '^[0-9a-f]{20}$', 'every appointment gets a 20-hex-char token');
select _assert(current_setting('test.t1') <> current_setting('test.t2'), 'tokens differ per appointment');

-- ---------- the public RPCs are for the app server only ----------
set local role anon;
select _assert_raises($q$ select * from public_appointment(current_setting('test.t1')) $q$, 'permission denied', 'anon cannot call public_appointment directly');
select _assert_raises($q$ select public_respond_appointment(current_setting('test.t1'), 'cancel') $q$, 'permission denied', 'anon cannot call public_respond_appointment directly');
select _assert_raises($q$ select * from appointments $q$, 'permission denied', 'anon still cannot read appointments');
set local role authenticated;
select _assert_raises($q$ select * from public_appointment(current_setting('test.t1')) $q$, 'permission denied', 'signed-in users cannot call it directly either');
reset role;

-- ---------- as the app server ----------
select _assert((select count(*) from public_appointment('0000000000000000000a')) = 0, 'unknown token shows nothing');
select _assert((select count(*) from public_appointment('not-a-token')) = 0, 'malformed token shows nothing');
select _assert((select patient_first_name = 'Lourdes' and doctor_name = 'Dr. Self Service' and clinic_name = 'SS Clinic'
                       and can_confirm and can_cancel
                  from public_appointment(current_setting('test.t1'))),
  'page shows first name, doctor, clinic and both actions');
select _assert((select not can_cancel from public_appointment(current_setting('test.t2'))),
  'cancel closes 2 hours before');

select _assert_raises($q$ select public_respond_appointment('0000000000000000000a', 'cancel') $q$, 'isn''t valid', 'unknown token refused');
select _assert_raises($q$ select public_respond_appointment(current_setting('test.t1'), 'delete') $q$, 'unknown action', 'unknown action refused');
select _assert_raises($q$ select public_respond_appointment(current_setting('test.t2'), 'cancel') $q$, 'too close', 'late cancel refused');
select _assert_raises($q$ select public_respond_appointment(current_setting('test.t3'), 'confirm') $q$, 'call the clinic', 'past visit refused');

select _assert(public_respond_appointment(current_setting('test.t1'), 'confirm') = 'confirmed', 'patient confirms');
select _assert(public_respond_appointment(current_setting('test.t1'), 'confirm') = 'confirmed', 'confirming twice is harmless');
select _assert(public_respond_appointment(current_setting('test.t1'), 'cancel') = 'cancelled', 'patient cancels');
select _assert_raises($q$ select public_respond_appointment(current_setting('test.t1'), 'confirm') $q$, 'call the clinic',
  'cancelled visit cannot be re-confirmed online');

select _assert((select status = 'cancelled' and patient_response = 'cancelled' and patient_responded_at is not null
                  from appointments where id = '00000000-0000-0000-0000-00000000f511'),
  'staff see the patient''s response');

drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
rollback;
