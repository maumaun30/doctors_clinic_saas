-- =====================================================================
-- 0010_available_slots.sql
-- Compute bookable time slots for a doctor at a clinic on a given
-- PH-local date. Walks every doctor_availability window for that
-- weekday in fixed-size steps, drops any slot that would overflow the
-- window or overlap an active appointment.
--
-- Returns timestamptz UTC values (start of slot). Render in PH local.
-- =====================================================================

create or replace function available_slots(
  p_doctor_id        uuid,
  p_clinic_id        uuid,
  p_date_local       date,
  p_duration_minutes int default 30,
  p_step_minutes     int default 15
)
returns table (slot_start timestamptz)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_dow smallint;
begin
  v_dow := extract(dow from p_date_local)::smallint;

  return query
  with windows as (
    select da.start_time, da.end_time
      from doctor_availability da
     where da.doctor_id = p_doctor_id
       and da.clinic_id = p_clinic_id
       and da.weekday   = v_dow
  ),
  steps as (
    select
      w.start_time,
      w.end_time,
      (w.start_time + (g * (p_step_minutes || ' minutes')::interval))::time as slot_t
    from windows w
    cross join generate_series(0, 1000) g
    where (w.start_time + (g * (p_step_minutes || ' minutes')::interval))::time
          < w.end_time
  ),
  candidates as (
    select
      ((p_date_local::text || ' ' || s.slot_t::text) || ' Asia/Manila')::timestamptz as ss,
      s.end_time as window_end
    from steps s
    where (s.slot_t + make_interval(mins => p_duration_minutes)) <= s.end_time
  )
  select c.ss
  from candidates c
  where c.ss > now()
    and not exists (
      select 1 from appointments a
      where a.doctor_id = p_doctor_id
        and a.status in ('scheduled','confirmed')
        and tstzrange(a.scheduled_at,
                      a.scheduled_at + make_interval(mins => a.duration_minutes), '[)')
            && tstzrange(c.ss, c.ss + make_interval(mins => p_duration_minutes), '[)')
    )
  order by c.ss;
end;
$$;

revoke all on function available_slots(uuid, uuid, date, int, int) from public;
grant execute on function available_slots(uuid, uuid, date, int, int) to authenticated;
