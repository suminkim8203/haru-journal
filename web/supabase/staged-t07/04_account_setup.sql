-- Staged only. Never claims or copies the legacy T06 diary.
begin;
create function public.haru_setup_account() returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=journal.require_account_user(); d uuid;
begin
 -- Lock the authenticated user: repeated/concurrent setup cannot leave orphan diaries.
 perform 1 from auth.users where id=u for update;
 select diary_id into d from journal.account_diaries where user_id=u;
 if d is not null then return d;end if;
 d:=gen_random_uuid();
 insert into journal.diaries(id) values(d);
 insert into journal.account_diaries(user_id,diary_id) values(u,d);
 return d;
end $$;
revoke all on function public.haru_setup_account() from public,anon;
grant execute on function public.haru_setup_account() to authenticated;
notify pgrst,'reload schema';
commit;
