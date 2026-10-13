-- =====================================================================
-- 0033 — "Get your clinic ready" checklist on Today (admins).
--
-- Progress is worked out from the account's data; the only stored state
-- is whether an admin hid the checklist, per account so it stays hidden
-- for every admin on every device. accounts has no update policy, so it
-- changes only through this function (admin with 2FA).
-- =====================================================================

alter table accounts add column if not exists setup_checklist_hidden_at timestamptz;

create or replace function admin_set_setup_checklist_hidden(p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'forbidden: only admins with two-factor authentication can change this';
  end if;
  update accounts
     set setup_checklist_hidden_at = case when p_hidden then now() else null end
   where id = current_account_id();
end;
$$;

revoke all on function admin_set_setup_checklist_hidden(boolean) from public, anon;
grant execute on function admin_set_setup_checklist_hidden(boolean) to authenticated;
