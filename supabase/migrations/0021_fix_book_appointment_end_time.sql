-- =====================================================================
-- 0021 — fix book_appointment(): staff booking always failed.
--
-- `ts + interval AT TIME ZONE 'Asia/Manila'` parses as
-- `ts + (interval AT TIME ZONE ...)` because AT TIME ZONE binds tighter
-- than +, so every call raised
--   function pg_catalog.timezone(unknown, interval) does not exist
-- Parenthesize the sum. Body otherwise identical to 0009's version;
-- CREATE OR REPLACE keeps the existing grants.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.book_appointment(p_patient_id uuid, p_doctor_id uuid, p_clinic_id uuid, p_scheduled_at timestamp with time zone, p_duration_minutes integer DEFAULT 30, p_notes text DEFAULT NULL::text)
 RETURNS appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_role    user_role;
  caller_account uuid;
  clinic_account uuid;
  patient_account uuid;
  has_perm       boolean;
  has_slot       boolean;
  overlap_count  int;
  inserted       appointments;
  scheduled_dow  smallint;
  scheduled_t    time;
  end_t          time;
begin
  select role, account_id into caller_role, caller_account
    from profiles where id = auth.uid();
  if caller_role is null or caller_role = 'pending' then
    raise exception 'forbidden';
  end if;

  select account_id into clinic_account  from clinics  where id = p_clinic_id;
  select account_id into patient_account from patients where id = p_patient_id;
  if clinic_account is null or patient_account is null then
    raise exception 'clinic or patient not found';
  end if;
  if clinic_account <> caller_account or patient_account <> caller_account then
    raise exception 'forbidden: cross-account';
  end if;

  if not exists (
    select 1 from doctor_clinics
     where doctor_id = p_doctor_id and clinic_id = p_clinic_id
  ) then
    raise exception 'doctor does not practice at this clinic';
  end if;

  has_perm :=
    caller_role = 'admin'
    or auth.uid() = p_doctor_id
    or exists (
      select 1
      from clinic_assignments ca
      join doctor_clinics dc on dc.id = ca.doctor_clinic_id
      where ca.secretary_id = auth.uid()
        and dc.doctor_id = p_doctor_id
        and dc.clinic_id = p_clinic_id
    );
  if not has_perm then
    raise exception 'forbidden: not authorized for this doctor/clinic';
  end if;

  scheduled_dow := extract(dow from p_scheduled_at at time zone 'Asia/Manila')::smallint;
  scheduled_t   := (p_scheduled_at at time zone 'Asia/Manila')::time;
  end_t         := ((p_scheduled_at + make_interval(mins => p_duration_minutes))
                    at time zone 'Asia/Manila')::time;

  select exists (
    select 1 from doctor_availability
    where doctor_id = p_doctor_id
      and clinic_id = p_clinic_id
      and weekday   = scheduled_dow
      and scheduled_t >= start_time
      and end_t      <= end_time
  ) into has_slot;
  if not has_slot then raise exception 'doctor not available at requested time'; end if;

  select count(*) into overlap_count
  from appointments a
  where a.doctor_id = p_doctor_id
    and a.status in ('scheduled','confirmed')
    and tstzrange(a.scheduled_at,
                  a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
        && tstzrange(p_scheduled_at,
                     p_scheduled_at + make_interval(mins => p_duration_minutes), '[)');
  if overlap_count > 0 then raise exception 'doctor double-booked'; end if;

  -- auto-link patient to clinic
  insert into patient_clinics(patient_id, clinic_id)
  values (p_patient_id, p_clinic_id)
  on conflict (patient_id, clinic_id) do nothing;

  insert into appointments(
    patient_id, doctor_id, clinic_id, scheduled_at,
    duration_minutes, status, created_by, notes
  ) values (
    p_patient_id, p_doctor_id, p_clinic_id, p_scheduled_at,
    p_duration_minutes, 'scheduled', auth.uid(), p_notes
  )
  returning * into inserted;

  return inserted;
end;
$function$;
