-- Server-only counters; no passwords, codes, email addresses or session tokens.
begin;
create table journal.auth_attempt_windows(subject text primary key,expires_at timestamptz not null,attempts integer not null default 0 check(attempts between 0 and 5));
revoke all on journal.auth_attempt_windows from public,anon,authenticated;
create function public.haru_auth_attempt(p_subject text,p_action text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r journal.auth_attempt_windows; instant timestamptz:=clock_timestamp();
begin
 if p_subject !~ '^[a-f0-9]{64}$' or p_action not in ('issue','verify','success') then raise exception 'Invalid input' using errcode='22023';end if;
 insert into journal.auth_attempt_windows(subject,expires_at) values(p_subject,instant+interval '10 minutes') on conflict do nothing;
 select * into r from journal.auth_attempt_windows where subject=p_subject for update;
 if p_action='success' then delete from journal.auth_attempt_windows where subject=p_subject;return true;end if;
 if r.expires_at<=instant then r.attempts:=0;r.expires_at:=instant+interval '10 minutes';end if;
 if p_action='issue' then
  -- Resending does not restore guesses. Extend to cover the new code lifetime.
  if r.attempts>=5 then return false;end if;
  update journal.auth_attempt_windows set expires_at=instant+interval '10 minutes',attempts=r.attempts where subject=p_subject;
  return true;
 end if;
 if r.attempts>=5 then return false;end if;
 update journal.auth_attempt_windows set expires_at=r.expires_at,attempts=r.attempts+1 where subject=p_subject;
 return true;
end $$;
revoke all on function public.haru_auth_attempt(text,text) from public,anon,authenticated;
grant execute on function public.haru_auth_attempt(text,text) to service_role;
notify pgrst,'reload schema';
commit;
