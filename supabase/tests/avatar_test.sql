-- =====================================================================
-- avatar_test.sql  —  profile pictures (0025).
-- =====================================================================
begin;
set local role postgres;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'ASSERT FAILED: %', p_msg; end if;
  raise notice 'ok: %', p_msg;
end;
$$;
create or replace function _assert_raises(p_sql text, p_like text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ilike '%' || p_like || '%' then raise notice 'ok: %', p_msg; return; end if;
    raise exception 'ASSERT FAILED: % (wrong error: %)', p_msg, sqlerrm;
  end;
  raise exception 'ASSERT FAILED: % (no error raised)', p_msg;
end;
$$;
create or replace function _as(p_uid uuid, p_role text, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role, 'aal', p_aal)::text, true);
  if p_role = 'authenticated' then set local role authenticated; else reset role; end if;
end;
$$;

insert into accounts(id, name) values
  ('00000000-0000-0000-0000-00000000a0a1', 'Avatars'),
  ('00000000-0000-0000-0000-00000000a0a2', 'Avatars elsewhere');
insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-00000000a0d1', 'pic-doc@clinic.test'),
  ('00000000-0000-0000-0000-00000000a0d2', 'pic-sec@clinic.test'),
  ('00000000-0000-0000-0000-00000000a0ad', 'pic-admin@clinic.test'),
  ('00000000-0000-0000-0000-00000000a0bd', 'pic-other-admin@clinic.test');
insert into profiles(id, account_id, role, full_name) values
  ('00000000-0000-0000-0000-00000000a0d1', '00000000-0000-0000-0000-00000000a0a1', 'doctor',    'Pic Doctor'),
  ('00000000-0000-0000-0000-00000000a0d2', '00000000-0000-0000-0000-00000000a0a1', 'secretary', 'Pic Secretary'),
  ('00000000-0000-0000-0000-00000000a0ad', '00000000-0000-0000-0000-00000000a0a1', 'admin',     'Pic Admin'),
  ('00000000-0000-0000-0000-00000000a0bd', '00000000-0000-0000-0000-00000000a0a2', 'admin',     'Other Admin')
on conflict (id) do update set account_id = excluded.account_id, role = excluded.role, full_name = excluded.full_name;

-- Real Supabase grants table access on storage.objects; RLS is what blocks.
grant select, insert, update, delete on storage.objects to authenticated;

select _assert((select public from storage.buckets where id = 'avatars'), 'avatars bucket exists and is public');

-- ---- a user sets their own picture ----
select _as('00000000-0000-0000-0000-00000000a0d1', 'authenticated');
update profiles set avatar_path = '00000000-0000-0000-0000-00000000a0d1/1.webp'
 where id = '00000000-0000-0000-0000-00000000a0d1';
select _assert((select avatar_path from profiles where id = '00000000-0000-0000-0000-00000000a0d1')
  = '00000000-0000-0000-0000-00000000a0d1/1.webp', 'user can set a picture in their own folder');

select _assert_raises($q$ update profiles set avatar_path = '00000000-0000-0000-0000-00000000a0d2/1.webp'
  where id = '00000000-0000-0000-0000-00000000a0d1' $q$,
  'profiles_avatar_path_own_folder', 'user cannot point their picture at another user''s folder');

-- ---- admins manage same-account staff pictures (needs 2FA) ----
select _as('00000000-0000-0000-0000-00000000a0d2', 'authenticated');
update profiles set avatar_path = '00000000-0000-0000-0000-00000000a0d1/x.webp'
 where id = '00000000-0000-0000-0000-00000000a0d1';
select _as(null, 'service_role');
select _assert((select avatar_path from profiles where id = '00000000-0000-0000-0000-00000000a0d1') like '%/1.webp',
  'secretary cannot change a doctor''s picture');

select _as('00000000-0000-0000-0000-00000000a0ad', 'authenticated', 'aal1');
update profiles set avatar_path = '00000000-0000-0000-0000-00000000a0d1/2.webp'
 where id = '00000000-0000-0000-0000-00000000a0d1';
select _as(null, 'service_role');
select _assert((select avatar_path from profiles where id = '00000000-0000-0000-0000-00000000a0d1') like '%/1.webp',
  'admin without 2FA cannot change a doctor''s picture');

select _as('00000000-0000-0000-0000-00000000a0bd', 'authenticated');
update profiles set avatar_path = '00000000-0000-0000-0000-00000000a0d1/3.webp'
 where id = '00000000-0000-0000-0000-00000000a0d1';
select _as(null, 'service_role');
select _assert((select avatar_path from profiles where id = '00000000-0000-0000-0000-00000000a0d1') like '%/1.webp',
  'admin of another account cannot change the picture');

select _as('00000000-0000-0000-0000-00000000a0ad', 'authenticated');
update profiles set avatar_path = '00000000-0000-0000-0000-00000000a0d1/4.webp'
 where id = '00000000-0000-0000-0000-00000000a0d1';
select _as(null, 'service_role');
select _assert((select avatar_path from profiles where id = '00000000-0000-0000-0000-00000000a0d1') like '%/4.webp',
  'admin with 2FA can change a same-account doctor''s picture');

select _as('00000000-0000-0000-0000-00000000a0ad', 'authenticated');
select _assert_raises($q$ update profiles set avatar_path = '00000000-0000-0000-0000-00000000a0ad/5.webp'
  where id = '00000000-0000-0000-0000-00000000a0d1' $q$,
  'profiles_avatar_path_own_folder', 'admin cannot point a doctor''s picture outside the doctor''s folder');

-- ---- storage writes are service_role only ----
select _as('00000000-0000-0000-0000-00000000a0d1', 'authenticated');
select _assert_raises($q$ insert into storage.objects(bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000a0d1/2.webp') $q$,
  'row-level security', 'signed-in user cannot write to the avatars bucket directly');

select _as(null, 'service_role');
insert into storage.objects(bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000a0d1/2.webp');
select _assert(exists(select 1 from storage.objects where bucket_id = 'avatars'), 'service_role can upload avatars');

drop function _assert(boolean, text);
drop function _assert_raises(text, text, text);
drop function _as(uuid, text, text);
rollback;
