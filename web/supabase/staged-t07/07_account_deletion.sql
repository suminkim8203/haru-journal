begin;
create table journal.account_deletions(
 user_id uuid primary key references auth.users(id) on delete cascade,
 requested_at timestamptz not null,delete_after timestamptz not null,
 check(delete_after=requested_at+interval '168 hours')
);
revoke all on journal.account_deletions from public,anon,authenticated,service_role;
create function journal.assert_account_active(u uuid) returns void
language plpgsql stable security definer set search_path='' as $$begin
 if exists(select 1 from journal.account_deletions where user_id=u) then
 raise exception 'Account deletion pending' using errcode='PT423';end if;
end $$;
revoke all on function journal.assert_account_active(uuid) from public,anon,authenticated,service_role;
create or replace function journal.require_account_diary() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=journal.require_account_user();d uuid;
begin
 perform journal.assert_account_active(u);
 select diary_id into d from journal.account_diaries where user_id=u;
 if d is null then raise exception 'Account setup required' using errcode='PT403';end if;
 return d;
end $$;
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.haru_setup_account()'::regprocedure);
 if position('select diary_id into d' in definition)=0 then raise exception 'Unexpected setup function';end if;
 definition:=replace(definition,'select diary_id into d','perform journal.assert_account_active(u); select diary_id into d');
 execute definition;
end $$;
create function public.haru_account_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=journal.require_account_user();r journal.account_deletions;
begin
 select * into r from journal.account_deletions where user_id=u;
 if not found then return jsonb_build_object('state','active');end if;
 return jsonb_build_object('state',case when r.delete_after>now() then 'pending' else 'expired' end,'deleteAfter',r.delete_after);
end $$;
create function public.haru_request_deletion() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=journal.require_account_user();r journal.account_deletions;d uuid;t timestamptz;
begin
 perform 1 from auth.users where id=u for update;
 select * into r from journal.account_deletions where user_id=u;
 if not found then
  if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=u and created_at>clock_timestamp()-interval '2 minutes') then
   raise exception 'Recent password authentication required' using errcode='PT403';end if;
  select diary_id into d from journal.account_diaries where user_id=u;
  perform 1 from journal.diaries where id=d for update;
  if exists(select 1 from journal.runs where diary_id=d and ended_at is null and deleted_at is null) then
   raise exception 'Stop recording before account deletion' using errcode='PT409';end if;
  t:=clock_timestamp();insert into journal.account_deletions values(u,t,t+interval '168 hours') returning * into r;
 end if;
 -- All existing authentication sessions are revoked, not only browser storage.
 delete from auth.sessions where user_id=u;
 return jsonb_build_object('state','pending','deleteAfter',r.delete_after);
end $$;
create function public.haru_cancel_deletion() returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=journal.require_account_user();r journal.account_deletions;
begin
 perform 1 from auth.users where id=u for update;
 select * into r from journal.account_deletions where user_id=u for update;
 if not found then return;end if;
 if r.delete_after<=clock_timestamp() then raise exception 'Deletion deadline passed' using errcode='PT410';end if;
 delete from journal.account_deletions where user_id=u;
end $$;
revoke all on function public.haru_account_status(),public.haru_request_deletion(),public.haru_cancel_deletion() from public,anon;
grant execute on function public.haru_account_status(),public.haru_request_deletion(),public.haru_cancel_deletion() to authenticated;
notify pgrst,'reload schema';
commit;
