-- =====================================================================
-- 0005_appointment_actions.sql
-- Cancel / mark no-show / reschedule. Reschedule re-runs the same
-- availability + overlap checks as book_appointment.
-- =====================================================================

create or replace function set_appointment_status(
  p_appointment_id uuid,
  p_status         appointment_status
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  out_row appointments;
begin
  if p_status not in ('scheduled','confirmed','cancelled','no_show') then
    raise exception 'use complete_appointment to mark completed';
  end if;
  -- RLS on appointments_update gates who may do this.
  update appointments set status = p_status
   where id = p_appointment_id
  returning * into out_row;
  if not found then
    raise exception 'appointment not found or not permitted';
  end if;
  return out_row;
end;
$$;

revoke all on function set_appointment_status(uuid, appointment_status) from public;
grant execute on function set_appointment_status(uuid, appointment_status) to authenticated;

-- ---------------------------------------------------------------------
create or replace function reschedule_appointment(
  p_appointment_id   uuid,
  p_scheduled_at     timestamptz,
  p_duration_minutes int default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
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
  end_t         := (p_scheduled_at + make_interval(mins => new_duration)
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
$$;

revoke all on function reschedule_appointment(uuid, timestamptz, int) from public;
grant execute on function reschedule_appointment(uuid, timestamptz, int) to authenticated;
