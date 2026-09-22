-- Staged only. Invalidates diary access even if the browser fails to finish global logout.
begin;
create table journal.password_revocations(user_id uuid primary key references auth.users(id) on delete cascade,changed_at timestamptz not null);
revoke all on journal.password_revocations from public,anon,authenticated,service_role;
create function journal.record_password_revocation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.encrypted_password is distinct from new.encrypted_password then
  insert into journal.password_revocations(user_id,changed_at) values(new.id,clock_timestamp())
  on conflict(user_id) do update set changed_at=excluded.changed_at;
 end if;
 return new;
end $$;
revoke all on function journal.record_password_revocation() from public,anon,authenticated,service_role;
create trigger haru_password_revocation after update of encrypted_password on auth.users
for each row execute function journal.record_password_revocation();
-- Retain all existing checks and add a server-side password-change watermark.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('journal.require_account_user()'::regprocedure);
 if position('and (s.not_after is null or s.not_after>now())' in definition)=0 then raise exception 'Unexpected session guard';end if;
 definition:=replace(definition,'and (s.not_after is null or s.not_after>now())',
 'and (s.not_after is null or s.not_after>now()) and not exists(select 1 from journal.password_revocations r where r.user_id=u and s.created_at<=r.changed_at)');
 execute definition;
end $$;
commit;
