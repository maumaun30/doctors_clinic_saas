-- =====================================================================
-- 0019_fix_list_pending_users_email.sql
-- auth.users.email is varchar(255) on Supabase, but list_pending_users
-- (0004) declares `email text`. RETURN QUERY doesn't coerce, so the RPC
-- failed with 42804 "structure of query does not match function result
-- type" and Admin → Pending users crashed. Cast explicitly. Same
-- signature, so grants are kept.
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
    select p.id, p.full_name, p.phone, u.email::text, p.created_at
    from profiles p
    join auth.users u on u.id = p.id
    where p.role = 'pending'
    order by p.created_at desc;
end;
$$;
