-- =====================================================================
-- exports_test.sql  —  private bucket for clinic data exports (0028).
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

-- Real Supabase grants table access on storage.objects; RLS is what blocks.
grant select, insert, update, delete on storage.objects to authenticated;
insert into storage.objects(bucket_id, name) values ('exports', '00000000-0000-0000-0000-0000000000aa/x.zip');

select _assert((select not public from storage.buckets where id = 'exports'), 'exports bucket exists and is private');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ab","role":"authenticated"}', true);
set local role authenticated;
select _assert((select count(*) from storage.objects where bucket_id = 'exports') = 0, 'signed-in users cannot list or read exports');
do $$ begin
  insert into storage.objects(bucket_id, name) values ('exports', 'sneaky.zip');
  raise exception 'ASSERT FAILED: signed-in user wrote to exports';
exception when insufficient_privilege then raise notice 'ok: signed-in users cannot write exports';
end $$;
reset role;

drop function _assert(boolean, text);
rollback;
