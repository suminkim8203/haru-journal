-- Core persistence. Apply once using a migration runner, not in the browser.
create schema if not exists journal;
revoke all on schema journal from public, anon, authenticated;
create table journal.diaries (
 id uuid primary key, timezone text not null default 'Asia/Seoul' check(timezone='Asia/Seoul'),
 revision bigint not null default 0 check(revision>=0)
);
create table journal.plans (
 id uuid primary key default gen_random_uuid(), diary_id uuid not null references journal.diaries(id),
 kind text not null check(kind in ('general','routine')), title text not null check(length(btrim(title)) between 1 and 120),
 start_date date, end_date date, success_text text not null default '' check(length(success_text)<=4000),
 estimated_minutes integer not null default 0 check(estimated_minutes between 0 and 525600),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(diary_id,id),
 check((kind='general' and start_date is not null and end_date is not null and end_date>=start_date)
 or (kind='routine' and start_date is null and end_date is null))
);
create table journal.tasks (
 id uuid primary key default gen_random_uuid(), diary_id uuid not null references journal.diaries(id), plan_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 120), description text not null default '' check(length(description)<=4000),
 due_date date, estimated_minutes integer not null default 0 check(estimated_minutes between 0 and 10080),
 priority text not null default 'normal' check(priority in ('high','normal','low')),
 complete boolean not null default false, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(diary_id,id), foreign key(diary_id,plan_id) references journal.plans(diary_id,id),
 check(complete=(completed_at is not null))
);
create table journal.command_receipts (
 diary_id uuid not null references journal.diaries(id), request_id uuid not null,
 request jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(diary_id,request_id)
);
create table journal.revisions (
 id bigint generated always as identity primary key, diary_id uuid not null references journal.diaries(id),
 entity_type text not null, entity_id uuid not null, previous_value jsonb not null, changed_at timestamptz not null default now()
);
alter table journal.diaries enable row level security;
alter table journal.plans enable row level security;
alter table journal.tasks enable row level security;
alter table journal.command_receipts enable row level security;
alter table journal.revisions enable row level security;
insert into journal.diaries(id) values ('00000000-0000-4000-8000-000000000006');
create function public.journal_snapshot(p_diary_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('diaryId',d.id,'timezone',d.timezone,'revision',d.revision,
 'plans',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at,p.id) from journal.plans p where p.diary_id=d.id and p.deleted_at is null),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from journal.tasks t where t.diary_id=d.id and t.deleted_at is null),'[]'::jsonb))
 from journal.diaries d where d.id=p_diary_id;
$$;
create function public.journal_command(p_diary_id uuid,p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare rev bigint; existing journal.command_receipts%rowtype; req jsonb; result jsonb; target uuid; old_task journal.tasks%rowtype; parent journal.plans%rowtype;
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_payload) is distinct from 'object' then
 raise exception 'Invalid command envelope' using errcode='22023'; end if;
 select revision into rev from journal.diaries where id=p_diary_id for update;
 if not found then raise exception 'Diary missing' using errcode='22023'; end if;
 req:=jsonb_build_object('command',p_command,'payload',p_payload,'expectedRevision',p_expected_revision);
 select * into existing from journal.command_receipts where diary_id=p_diary_id and request_id=p_request_id;
 if found then
 if existing.request<>req then raise exception 'Request ID reused with different content' using errcode='P0002'; end if;
 return existing.result;
 end if;
 if rev<>p_expected_revision then raise exception 'Revision conflict' using errcode='P0001'; end if;
 if p_command='create_plan' then
 if p_payload->>'kind' is distinct from 'general' then raise exception 'Only general plan creation is enabled' using errcode='22023'; end if;
 insert into journal.plans(diary_id,kind,title,start_date,end_date,success_text,estimated_minutes)
 values(p_diary_id,'general',btrim(p_payload->>'title'),(p_payload->>'startDate')::date,(p_payload->>'endDate')::date,
 coalesce(p_payload->>'successText',''),coalesce((p_payload->>'estimatedMinutes')::integer,0)) returning id into target;
 elsif p_command='create_task' then
 select * into parent from journal.plans where diary_id=p_diary_id and id=(p_payload->>'planId')::uuid and deleted_at is null;
 if not found or parent.kind<>'general' then raise exception 'Active general plan required' using errcode='22023'; end if;
 insert into journal.tasks(diary_id,plan_id,title,due_date,estimated_minutes,priority,description)
 values(p_diary_id,parent.id,btrim(p_payload->>'title'),nullif(p_payload->>'dueDate','')::date,
 coalesce((p_payload->>'estimatedMinutes')::integer,0),coalesce(p_payload->>'priority','normal'),coalesce(p_payload->>'description','')) returning id into target;
 elsif p_command='set_task_complete' then
 select * into old_task from journal.tasks where diary_id=p_diary_id and id=(p_payload->>'taskId')::uuid and deleted_at is null;
 if not found then raise exception 'Active task required' using errcode='22023'; end if;
 if jsonb_typeof(p_payload->'complete') is distinct from 'boolean' then raise exception 'Boolean required' using errcode='22023'; end if;
 if not exists(select 1 from journal.plans where id=old_task.plan_id and diary_id=p_diary_id and deleted_at is null) then raise exception 'Active plan required' using errcode='22023'; end if;
 target:=old_task.id;
 insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(p_diary_id,'task',target,to_jsonb(old_task));
 update journal.tasks set complete=(p_payload->>'complete')::boolean,
 completed_at=case when (p_payload->>'complete')::boolean then coalesce(completed_at,now()) else null end,updated_at=now() where id=target;
 else raise exception 'Unsupported command' using errcode='22023'; end if;
 update journal.diaries set revision=revision+1 where id=p_diary_id returning revision into rev;
 result:=jsonb_build_object('revision',rev,'entityId',target);
 insert into journal.command_receipts(diary_id,request_id,request,result) values(p_diary_id,p_request_id,req,result);
 return result;
end;$$;
revoke all on function public.journal_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.journal_command(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.journal_snapshot(uuid) to service_role;
grant execute on function public.journal_command(uuid,uuid,bigint,text,jsonb) to service_role;
