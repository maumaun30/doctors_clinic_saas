-- =====================================================================
-- 0018_billing.sql
-- Per-doctor-seat subscriptions (Stripe) with a 14-day no-card trial.
--
--   * accounts gain trial + Stripe subscription state. Only service_role
--     writes these (Stripe webhook); accounts still has no update policy
--     for authenticated users, so they cannot be forged from a browser.
--   * account_is_active(account) — trial running, or subscription in a
--     good standing status (active / trialing / past_due while Stripe
--     retries the card).
--   * Read-only enforcement: a BEFORE INSERT/UPDATE/DELETE trigger on every
--     business table raises `account_read_only` when the *calling user's*
--     account is inactive. A trigger (not RLS) so SECURITY DEFINER RPCs
--     are covered too. Calls without a user (service_role: webhook,
--     reminders, public booking) pass; reads are never blocked.
--   * Online booking is unavailable while the clinic's account is inactive.
--   * stripe_events — processed webhook event ids, for idempotency.
-- =====================================================================

alter table accounts
  add column if not exists trial_ends_at          timestamptz not null default (now() + interval '14 days'),
  add column if not exists stripe_customer_id     text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists subscription_status    text,  -- Stripe's status, verbatim
  add column if not exists current_period_end     timestamptz,
  add column if not exists seat_quantity          int;

create table if not exists stripe_events (
  id           text primary key,   -- Stripe event id (evt_…)
  type         text not null,
  received_at  timestamptz not null default now()
);
alter table stripe_events enable row level security;
revoke all on stripe_events from anon, authenticated;

-- ---------------------------------------------------------------------
create or replace function account_is_active(p_account_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select coalesce((
    select a.trial_ends_at > now()
        or a.subscription_status in ('active', 'trialing', 'past_due')
    from accounts a where a.id = p_account_id
  ), false)
$$;

-- Billing summary for the signed-in user's own account (any role), for
-- the read-only banner and billing page.
create or replace function my_billing_status()
returns table (
  account_id          uuid,
  is_active           boolean,
  trial_ends_at       timestamptz,
  subscription_status text,
  current_period_end  timestamptz,
  seat_quantity       int,
  doctor_count        int,
  has_customer        boolean
)
language sql
stable security definer
set search_path = public
as $$
  select a.id,
         account_is_active(a.id),
         a.trial_ends_at,
         a.subscription_status,
         a.current_period_end,
         a.seat_quantity,
         (select count(*)::int from profiles p
           where p.account_id = a.id and p.role = 'doctor'),
         a.stripe_customer_id is not null
  from accounts a
  where a.id = current_account_id();
$$;

-- ---------------------------------------------------------------------
create or replace function enforce_account_writable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
begin
  if auth.uid() is null then
    return coalesce(new, old);          -- service_role / system work
  end if;
  select account_id into v_account from profiles where id = auth.uid();
  if v_account is not null and not account_is_active(v_account) then
    raise exception 'account_read_only: subscription inactive — ask an admin to subscribe under Admin → Billing'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'patients', 'patient_clinics', 'patient_conditions',
    'appointments', 'medical_records', 'prescriptions',
    'lab_orders', 'lab_result_files',
    'clinics', 'doctors', 'doctor_clinics', 'doctor_availability', 'clinic_assignments',
    'common_conditions', 'common_lab_tests', 'common_medications'
  ])
  loop
    execute format('drop trigger if exists zz_account_writable_%I on %I', t, t);
    -- zz_ prefix: BEFORE triggers fire alphabetically; run after any others.
    execute format(
      'create trigger zz_account_writable_%I before insert or update or delete on %I
         for each row execute function enforce_account_writable()', t, t);
  end loop;
end$$;

-- Online bookings come in as service_role, so the trigger above lets them
-- through; block them here instead when the clinic's account is inactive.
create or replace function enforce_online_booking_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'online' and not account_is_active(
       (select account_id from clinics where id = new.clinic_id)) then
    raise exception 'booking: online booking is not available for this clinic';
  end if;
  return new;
end;
$$;

drop trigger if exists online_booking_active on appointments;
create trigger online_booking_active before insert on appointments
  for each row execute function enforce_online_booking_active();

-- Hide the public booking page for inactive accounts.
create or replace function public_booking_info(p_slug text)
returns table (
  clinic_id      uuid,
  clinic_name    text,
  clinic_address text,
  doctors        jsonb
)
language sql
stable security definer
set search_path = public
as $$
  select c.id, c.name, c.address,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', d.profile_id,
                    'name', p.full_name,
                    'specialization', d.specialization)
                  order by p.full_name)
           from doctor_clinics dc
           join doctors  d on d.profile_id = dc.doctor_id
           join profiles p on p.id = d.profile_id
           where dc.clinic_id = c.id
         ), '[]'::jsonb)
  from clinics c
  where c.booking_slug = lower(p_slug)
    and c.online_booking
    and account_is_active(c.account_id);
$$;

-- ---------------------------------------------------------------------
-- Grants (0014 policy: anon nothing; trigger fns not callable at all).
revoke all on function account_is_active(uuid)        from public, anon, authenticated;
revoke all on function enforce_account_writable()     from public, anon, authenticated;
revoke all on function enforce_online_booking_active() from public, anon, authenticated;
revoke all on function public_booking_info(text)      from public, anon, authenticated;
revoke all on function my_billing_status()            from public, anon;
grant execute on function my_billing_status()         to authenticated;
