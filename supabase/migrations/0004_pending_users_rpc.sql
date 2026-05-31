-- =====================================================================
-- 0004_pending_users_rpc.sql
-- Pending users have account_id = null, so the per-account admin RLS
-- policy on `profiles` hides them. Admins need a way to discover them
-- to approve. Expose a narrow security-definer RPC instead of widening
-- RLS.
-- =====================================================================

create or replace function list_pending_users()
returns table (
  id         uuid,
  full_name  text,
  phone      text,
  email      text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  return query
    select p.id, p.full_name, p.phone, u.email, p.created_at
    from profiles p
    join auth.users u on u.id = p.id
    where p.role = 'pending'
    order by p.created_at desc;
end;
$$;

revoke all on function list_pending_users() from public;
grant execute on function list_pending_users() to authenticated;
