-- Staged only: NOT an automatic production migration. Existing public RPCs unchanged.
-- Apply only with a complete private-RPC cutover; this foundation alone does not protect T06.
begin;
create table journal.account_diaries (
 user_id uuid primary key references auth.users(id),
 diary_id uuid not null unique references journal.diaries(id),
 created_at timestamptz not null default now()
);
revoke all on journal.account_diaries from public,anon,authenticated,service_role;
create function journal.require_account_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); sid uuid; d uuid; claims jsonb:=auth.jwt();
begin
 if u is null then raise exception 'Authentication required' using errcode='PT401';end if;
 begin sid:=(claims->>'session_id')::uuid;
 exception when invalid_text_representation then raise exception 'Authentication required' using errcode='PT401';end;
 if sid is null or not exists (
  select 1 from auth.sessions s join auth.users a on a.id=s.user_id
  where s.id=sid and s.user_id=u and a.email_confirmed_at is not null
   and s.created_at>now()-interval '7 days'
   and (s.not_after is null or s.not_after>now())
 ) then raise exception 'Session expired' using errcode='PT401';end if;
 -- Fail closed: only password-authenticated sessions enter the diary in this foundation.
 -- Signup OTP/recovery sessions are not implicitly granted diary access.
 if not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(claims->'amr')='array' then claims->'amr' else '[]'::jsonb end) m where m->>'method'='password')
 then raise exception 'Password authentication required' using errcode='PT403';end if;
 return u;
end $$;
revoke all on function journal.require_account_user() from public,anon,authenticated,service_role;
create function journal.require_account_diary() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=journal.require_account_user(); d uuid;
begin
 select diary_id into d from journal.account_diaries where user_id=u;
 if d is null then raise exception 'Account setup required' using errcode='PT403';end if;
 return d;
end $$;
revoke all on function journal.require_account_diary() from public,anon,authenticated,service_role;
commit;
