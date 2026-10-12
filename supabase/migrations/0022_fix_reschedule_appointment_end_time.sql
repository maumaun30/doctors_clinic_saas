-- =====================================================================
-- 0022 — fix reschedule_appointment(): rescheduling always failed.
--
-- Same precedence bug as book_appointment() (fixed in 0021):
-- `ts + interval AT TIME ZONE ...` parses as `ts + (interval AT TIME ZONE
-- ...)` and raised "function pg_catalog.timezone(unknown, interval) does
-- not exist". Parenthesize the sum. Body otherwise identical to 0005's
-- version; CREATE OR REPLACE keeps the existing grants.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_appointment_id uuid, p_scheduled_at timestamp with time zone, p_duration_minutes integer DEFAULT NULL::integer)
 RETURNS appointments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  appt           appointments;
  new_duration   int;
  scheduled_dow  smallint;
  scheduled_t    time;
  end_t          time;
  has_slot       boolean;
  overlap_count  int;
  updated        appointments;
begin
  select * into appt from appointments where id = p_appointment_id;
  if not found then raise exception 'appointment not found'; end if;

  new_duration := coalesce(p_duration_minutes, appt.duration_minutes);

  -- availability (PH local)
  scheduled_dow := extract(dow from p_scheduled_at at time zone 'Asia/Manila')::smallint;
  scheduled_t   := (p_scheduled_at at time zone 'Asia/Manila')::time;
  end_t         := ((p_scheduled_at + make_interval(mins => new_duration))
                    at time zone 'Asia/Manila')::time;

  select exists (
    select 1 from doctor_availability
    where doctor_id = appt.doctor_id
      and clinic_id = appt.clinic_id
      and weekday   = scheduled_dow
      and scheduled_t >= start_time
      and end_t      <= end_time
  ) into has_slot;
  if not has_slot then raise exception 'doctor not available at requested time'; end if;

  -- overlap (excluding self)
  select count(*) into overlap_count
  from appointments a
  where a.doctor_id = appt.doctor_id
    and a.id <> p_appointment_id
    and a.status in ('scheduled','confirmed')
    and tstzrange(a.scheduled_at,
                  a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
        && tstzrange(p_scheduled_at,
                     p_scheduled_at + make_interval(mins => new_duration), '[)');
  if overlap_count > 0 then raise exception 'doctor double-booked'; end if;

  update appointments
     set scheduled_at = p_scheduled_at,
         duration_minutes = new_duration
   where id = p_appointment_id
  returning * into updated;
  if not found then raise exception 'not permitted'; end if;
  return updated;
end;
$function$;
