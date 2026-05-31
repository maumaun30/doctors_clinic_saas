-- =====================================================================
-- 0013_audit_log.sql
-- Trigger-based audit trail for clinical and patient writes.
-- One row per INSERT/UPDATE/DELETE on the audited tables. Captures
-- who (auth.uid), what (table + row id), op, before/after jsonb, and
-- account_id for tenant-scoped reads.
--
-- Admin-only read, RLS-scoped to their account. Writes happen via
-- triggers (security definer) so users never insert directly.
-- =====================================================================

create table audit_log (
  id          bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,                       -- auth.uid() at write time (may be null for service_role / triggers)
  account_id  uuid,                       -- denormalized for fast tenant scoping
  table_name  text not null,
  row_id      uuid,
  operation   text not null check (operation in ('INSERT','UPDATE','DELETE')),
  before      jsonb,
  after       jsonb
);
create index audit_log_account_time_idx on audit_log(account_id, occurred_at desc);
create index audit_log_table_row_idx    on audit_log(table_name, row_id);
create index audit_log_actor_time_idx   on audit_log(actor_id, occurred_at desc);

alter table audit_log enable row level security;

-- Admin-only read, scoped to their account.
create policy audit_log_admin_select
  on audit_log for select
  using (is_admin() and account_id = current_account_id());

-- No INSERT/UPDATE/DELETE policies → no one can write/modify via the
-- API. The trigger function below runs as security definer.

-- =====================================================================
-- account-id resolver
-- =====================================================================
create or replace function _resolve_account_id(p_table text, p_row jsonb)
returns uuid
language plpgsql
stable security definer
set search_path = public
as $$
declare
  acc uuid;
  pid uuid;
  mid uuid;
  lo  uuid;
begin
  -- direct fields first
  acc := nullif(p_row->>'account_id','')::uuid;
  if acc is not null then return acc; end if;

  pid := nullif(p_row->>'patient_id','')::uuid;
  if pid is not null then
    select account_id into acc from patients where id = pid;
    if acc is not null then return acc; end if;
  end if;

  -- medical_records / appointments via clinic_id
  if p_table in ('medical_records','appointments') then
    select c.account_id into acc
      from clinics c
      where c.id = nullif(p_row->>'clinic_id','')::uuid;
    if acc is not null then return acc; end if;
  end if;

  -- lab_result_files: go through lab_orders → patients
  if p_table = 'lab_result_files' then
    lo := nullif(p_row->>'lab_order_id','')::uuid;
    if lo is not null then
      select p.account_id into acc
        from lab_orders l join patients p on p.id = l.patient_id
       where l.id = lo;
    end if;
  end if;

  return acc;
end;
$$;

-- =====================================================================
-- Generic audit trigger
-- =====================================================================
create or replace function audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_j jsonb;
  after_j  jsonb;
  src      jsonb;
  acc      uuid;
  row_uuid uuid;
begin
  if tg_op = 'INSERT' then
    after_j := to_jsonb(new);
    src     := after_j;
  elsif tg_op = 'UPDATE' then
    before_j := to_jsonb(old);
    after_j  := to_jsonb(new);
    src      := after_j;
  else  -- DELETE
    before_j := to_jsonb(old);
    src      := before_j;
  end if;

  acc := _resolve_account_id(tg_table_name, src);
  row_uuid := nullif(src->>'id','')::uuid;

  insert into audit_log(
    actor_id, account_id, table_name, row_id, operation, before, after
  ) values (
    auth.uid(), acc, tg_table_name, row_uuid, tg_op, before_j, after_j
  );

  return coalesce(new, old);
end;
$$;

-- =====================================================================
-- Attach to audited tables
-- =====================================================================
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'patients',
    'medical_records',
    'prescriptions',
    'lab_orders',
    'lab_result_files',
    'patient_conditions',
    'appointments'
  ])
  loop
    execute format('drop trigger if exists audit_%I on %I', t, t);
    execute format(
      'create trigger audit_%I after insert or update or delete on %I
         for each row execute function audit_trigger()',
      t, t
    );
  end loop;
end$$;
