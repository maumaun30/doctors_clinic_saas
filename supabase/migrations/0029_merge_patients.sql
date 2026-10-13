-- =====================================================================
-- 0029 — find and merge duplicate patients (admins with 2FA).
--
--   * admin_find_duplicate_patients(): likely duplicate pairs in the
--     caller's account, with the reason they matched. Same name with
--     two different birthdays is treated as two people.
--   * patient_not_duplicates: pairs an admin marked "not the same
--     person", so they stop being suggested.
--   * admin_merge_patients(keep, remove): moves every appointment,
--     visit, prescription, lab order, problem and clinic link from
--     `remove` to `keep`, fills `keep`'s blank details from `remove`,
--     then deletes `remove`. One transaction; audited.
-- =====================================================================

-- ---------- "not duplicates" decisions ----------
create table if not exists patient_not_duplicates (
  account_id   uuid not null references accounts(id) on delete cascade,
  patient_a    uuid not null references patients(id) on delete cascade,
  patient_b    uuid not null references patients(id) on delete cascade,
  dismissed_by uuid references profiles(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  primary key (patient_a, patient_b),
  check (patient_a < patient_b)
);
create index if not exists patient_not_duplicates_b_idx on patient_not_duplicates(patient_b);
create index if not exists patient_not_duplicates_account_idx on patient_not_duplicates(account_id);

alter table patient_not_duplicates enable row level security;

drop policy if exists patient_not_duplicates_admin on patient_not_duplicates;
create policy patient_not_duplicates_admin
  on patient_not_duplicates for all
  using (is_admin() and account_id = current_account_id())
  with check (is_admin() and account_id = current_account_id());

drop policy if exists zz_caller_active on patient_not_duplicates;
create policy zz_caller_active on patient_not_duplicates as restrictive for all to authenticated
  using ((select caller_is_active())) with check ((select caller_is_active()));

drop trigger if exists zz_account_writable_patient_not_duplicates on patient_not_duplicates;
create trigger zz_account_writable_patient_not_duplicates before insert or update or delete on patient_not_duplicates
  for each row execute function enforce_account_writable();

grant select, insert, delete on patient_not_duplicates to authenticated;

-- ---------- suggestions ----------
create or replace function admin_find_duplicate_patients(p_limit int default 100)
returns table (patient_a uuid, patient_b uuid, reason text)
language plpgsql
stable security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'forbidden: only admins with two-factor authentication can merge patients';
  end if;

  return query
  with p as (
    select x.id, x.created_at,
           lower(regexp_replace(btrim(x.full_name), '\s+', ' ', 'g')) as nm,
           x.date_of_birth as dob,
           -- Last 10 digits, so 0917…, +63917… and 63917… match.
           nullif(right(regexp_replace(coalesce(x.phone, ''), '\D', '', 'g'), 10), '') as ph,
           nullif(lower(btrim(x.email)), '') as em
      from patients x
     where x.account_id = current_account_id()
  ),
  -- Two equality joins instead of one OR join, so large lists stay fast.
  cand as (
    select a.*, b.id as b_id, b.created_at as b_created, b.dob as b_dob, b.ph as b_ph, b.em as b_em, b.nm as b_nm
      from p a join p b on b.nm = a.nm and (a.created_at, a.id) < (b.created_at, b.id)
    union
    select a.*, b.id, b.created_at, b.dob, b.ph, b.em, b.nm
      from p a join p b on b.dob = a.dob and (a.created_at, a.id) < (b.created_at, b.id)
  ),
  scored as (
    select c.id as a_id, c.b_id,
           case
             when c.nm = c.b_nm and c.dob = c.b_dob then 'Same name and birthday'
             when c.nm = c.b_nm and c.dob is not null and c.b_dob is not null then null  -- different people
             when c.nm = c.b_nm and length(c.ph) >= 7 and c.ph = c.b_ph then 'Same name and mobile'
             when c.nm = c.b_nm and c.em = c.b_em then 'Same name and email'
             when c.nm = c.b_nm then 'Same name'
             when c.dob = c.b_dob and length(c.ph) >= 7 and c.ph = c.b_ph then 'Same birthday and mobile'
             when c.dob = c.b_dob and c.em = c.b_em then 'Same birthday and email'
           end as why,
           c.nm
      from cand c
  )
  select s.a_id, s.b_id, s.why
    from scored s
   where s.why is not null
     and not exists (
       select 1 from patient_not_duplicates d
        where d.patient_a = least(s.a_id, s.b_id) and d.patient_b = greatest(s.a_id, s.b_id)
     )
   order by (s.why = 'Same name'), s.nm
   limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function admin_find_duplicate_patients(int) from public, anon;
grant execute on function admin_find_duplicate_patients(int) to authenticated;

-- ---------- merge ----------
create or replace function admin_merge_patients(p_keep uuid, p_remove uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep   patients;
  v_remove patients;
  v_counts jsonb := '{}'::jsonb;
  n        int;
begin
  if not is_admin() then
    raise exception 'forbidden: only admins with two-factor authentication can merge patients';
  end if;
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'same_patient: pick two different patients';
  end if;

  -- Lock both rows in a fixed order so concurrent merges can't deadlock.
  perform 1 from patients
   where id in (p_keep, p_remove) and account_id = current_account_id()
   order by id for update;
  select * into v_keep from patients where id = p_keep and account_id = current_account_id();
  select * into v_remove from patients where id = p_remove and account_id = current_account_id();
  if v_keep.id is null or v_remove.id is null then
    raise exception 'not_found: patient not found in this account';
  end if;

  -- Keep the chosen record's details; fill only what it's missing.
  update patients set
    date_of_birth = coalesce(date_of_birth, v_remove.date_of_birth),
    sex           = coalesce(sex, v_remove.sex),
    phone         = coalesce(nullif(btrim(phone), ''), v_remove.phone),
    email         = coalesce(nullif(btrim(email), ''), v_remove.email),
    address       = coalesce(nullif(btrim(address), ''), v_remove.address),
    created_at    = least(created_at, v_remove.created_at)
  where id = p_keep;

  update appointments set patient_id = p_keep where patient_id = p_remove;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('appointments', n);
  update medical_records set patient_id = p_keep where patient_id = p_remove;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('visits', n);
  update prescriptions set patient_id = p_keep where patient_id = p_remove;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('prescriptions', n);
  update lab_orders set patient_id = p_keep where patient_id = p_remove;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('lab_orders', n);
  update patient_conditions set patient_id = p_keep where patient_id = p_remove;
  get diagnostics n = row_count; v_counts := v_counts || jsonb_build_object('conditions', n);

  insert into patient_clinics(patient_id, clinic_id)
  select p_keep, pc.clinic_id from patient_clinics pc where pc.patient_id = p_remove
  on conflict (patient_id, clinic_id) do nothing;

  -- Cascades the removed patient's clinic links and "not duplicate" marks.
  delete from patients where id = p_remove;

  insert into audit_log(actor_id, account_id, table_name, row_id, operation, before, after)
  values (auth.uid(), v_keep.account_id, 'patients', p_keep, 'UPDATE',
          jsonb_build_object('merged_patient', to_jsonb(v_remove)),
          jsonb_build_object('merged_into', p_keep, 'name', v_keep.full_name, 'moved', v_counts));

  return v_counts;
end;
$$;

revoke all on function admin_merge_patients(uuid, uuid) from public, anon;
grant execute on function admin_merge_patients(uuid, uuid) to authenticated;
