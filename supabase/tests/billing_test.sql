-- =====================================================================
-- billing_test.sql  —  trial / subscription gating (0018).
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

create or replace function _as(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  set local role authenticated;
end;
$$;

insert into accounts(id, name) values ('00000000-0000-0000-0000-0000000005a1', 'Billing Acct');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-0000000005ad', 'billadmin@test'),
  ('00000000-0000-0000-0000-0000000005d1', 'billdoc@test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000005ad', '00000000-0000-0000-0000-0000000005a1', 'admin',  'Bill Admin'),
  ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005a1', 'doctor', 'Dr Bill')
on conflict (id) do update
  set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;
insert into doctors(profile_id) values ('00000000-0000-0000-0000-0000000005d1');
insert into clinics(id, account_id, name, online_booking, booking_slug) values
  ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a1', 'Bill Clinic', true, 'bill-clinic');
insert into doctor_clinics(doctor_id, clinic_id) values
  ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005c1');
insert into doctor_availability(doctor_id, clinic_id, weekday, start_time, end_time)
values ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005c1',
        extract(dow from (now() at time zone 'Asia/Manila')::date + 1)::smallint, '09:00', '10:00');

-- ---- new accounts start on a 14-day trial ----
select _assert((select trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 minute'
                  from accounts where id = '00000000-0000-0000-0000-0000000005a1'),
  'new account gets a 14-day trial');
select _assert(account_is_active('00000000-0000-0000-0000-0000000005a1'), 'trialing account is active');

-- ---- active: writes allowed, billing status visible ----
select _as('00000000-0000-0000-0000-0000000005ad');
select _assert((select is_active and doctor_count = 1 and not has_customer from my_billing_status()),
  'my_billing_status: active, 1 doctor, no customer yet');
select create_patient('00000000-0000-0000-0000-0000000005c1', 'Trial Patient');
select _assert(exists(select 1 from patients where full_name = 'Trial Patient'), 'trial: admin can create patient');
reset role; select set_config('request.jwt.claim.sub', '', true);

-- ---- billing columns can't be forged by users ----
select _as('00000000-0000-0000-0000-0000000005ad');
update accounts set subscription_status = 'active' where id = '00000000-0000-0000-0000-0000000005a1';
reset role; select set_config('request.jwt.claim.sub', '', true);
select _assert((select subscription_status is null from accounts where id = '00000000-0000-0000-0000-0000000005a1'),
  'admin cannot set subscription_status');

-- ---- trial over, no subscription: read-only ----
update accounts set trial_ends_at = now() - interval '1 day' where id = '00000000-0000-0000-0000-0000000005a1';
select _assert(not account_is_active('00000000-0000-0000-0000-0000000005a1'), 'expired trial is inactive');

select _as('00000000-0000-0000-0000-0000000005ad');
select _assert((select not is_active from my_billing_status()), 'my_billing_status reports inactive');
select _assert((select count(*) from patients where full_name = 'Trial Patient') = 1, 'read-only: reads still work');
select _assert_raises($q$ select create_patient('00000000-0000-0000-0000-0000000005c1', 'Blocked') $q$,
  'account_read_only', 'read-only: SECURITY DEFINER RPC write blocked');
select _assert_raises($q$ update patients set phone = '0917' where full_name = 'Trial Patient' $q$,
  'account_read_only', 'read-only: direct update blocked');
select _assert_raises($q$ delete from patients where full_name = 'Trial Patient' $q$,
  'account_read_only', 'read-only: delete blocked');
select _assert_raises($q$ update clinics set name = 'X' where id = '00000000-0000-0000-0000-0000000005c1' $q$,
  'account_read_only', 'read-only: clinic edit blocked');
reset role; select set_config('request.jwt.claim.sub', '', true);

-- Service role (no user) is unaffected — webhooks, reminders keep working.
update patients set phone = '0917 000 0000' where full_name = 'Trial Patient';
select _assert((select phone = '0917 000 0000' from patients where full_name = 'Trial Patient'), 'service role can still write');

-- Online booking is off while inactive.
select _assert(not exists(select 1 from public_booking_info('bill-clinic')), 'inactive: booking page hidden');
select _assert_raises($q$ select * from public_book_appointment('bill-clinic', '00000000-0000-0000-0000-0000000005d1',
    (((now() at time zone 'Asia/Manila')::date + 1 + time '09:00') at time zone 'Asia/Manila'), 'Walk In', '0917 555 0000') $q$,
  'not available for this clinic', 'inactive: online booking rejected');

-- ---- subscription states ----
update accounts set subscription_status = 'active' where id = '00000000-0000-0000-0000-0000000005a1';
select _assert(account_is_active('00000000-0000-0000-0000-0000000005a1'), 'active subscription is active');
select _as('00000000-0000-0000-0000-0000000005ad');
select create_patient('00000000-0000-0000-0000-0000000005c1', 'Paid Patient');
select _assert(exists(select 1 from patients where full_name = 'Paid Patient'), 'subscribed: writes allowed again');
reset role; select set_config('request.jwt.claim.sub', '', true);
select _assert(exists(select 1 from public_booking_info('bill-clinic')), 'subscribed: booking page back');

update accounts set subscription_status = 'past_due' where id = '00000000-0000-0000-0000-0000000005a1';
select _assert(account_is_active('00000000-0000-0000-0000-0000000005a1'), 'past_due keeps access while Stripe retries');
update accounts set subscription_status = 'unpaid' where id = '00000000-0000-0000-0000-0000000005a1';
select _assert(not account_is_active('00000000-0000-0000-0000-0000000005a1'), 'unpaid is inactive');
update accounts set subscription_status = 'canceled' where id = '00000000-0000-0000-0000-0000000005a1';
select _assert(not account_is_active('00000000-0000-0000-0000-0000000005a1'), 'canceled is inactive');

-- ---- grants ----
select _as('00000000-0000-0000-0000-0000000005ad');
select _assert_raises($q$ select account_is_active('00000000-0000-0000-0000-0000000005a1') $q$,
  'permission denied', 'authenticated cannot call account_is_active');
select _assert_raises($q$ select * from stripe_events $q$, 'permission denied', 'authenticated cannot read stripe_events');
reset role; select set_config('request.jwt.claim.sub', '', true);

drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid);
rollback;
