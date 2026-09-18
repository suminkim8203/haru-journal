-- Follow-up to 0001_core.sql. Do not replace an already applied migration.
begin;
alter table journal.plans add column priority text not null default 'normal'
  check (priority in ('high','normal','low'));
create table journal.tags (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references journal.diaries(id),
  name text not null check (name=btrim(name) and length(name) between 1 and 30),
  unique(diary_id,id), unique(diary_id,name)
);
create table journal.task_tags (
  diary_id uuid not null references journal.diaries(id), task_id uuid not null, tag_id uuid not null,
  primary key(diary_id,task_id,tag_id),
  foreign key(diary_id,task_id) references journal.tasks(diary_id,id),
  foreign key(diary_id,tag_id) references journal.tags(diary_id,id)
);
alter table journal.tags enable row level security;
alter table journal.task_tags enable row level security;
revoke all on journal.tags,journal.task_tags from public,anon,authenticated;

create or replace function public.journal_snapshot(p_diary_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('schemaVersion',2,'diaryId',d.id,'timezone',d.timezone,'revision',d.revision,
 'plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('history',coalesce((
   select jsonb_agg(jsonb_build_object('id',r.id,'changed_at',r.changed_at,'previous_value',r.previous_value)
     order by r.changed_at desc,r.id desc)
   from journal.revisions r where r.diary_id=p.diary_id and r.entity_type='plan' and r.entity_id=p.id
   ),'[]'::jsonb)) order by p.created_at,p.id)
   from journal.plans p where p.diary_id=d.id and p.deleted_at is null),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('tags',coalesce((
   select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name,g.id)
   from journal.task_tags l join journal.tags g on (g.diary_id,g.id)=(l.diary_id,l.tag_id)
   where l.diary_id=t.diary_id and l.task_id=t.id),'[]'::jsonb)) order by t.created_at,t.id)
   from journal.tasks t where t.diary_id=d.id and t.deleted_at is null),'[]'::jsonb))
 from journal.diaries d where d.id=p_diary_id;
$$;

create or replace function public.journal_command(
 p_diary_id uuid,p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 rev bigint; existing journal.command_receipts%rowtype; req jsonb; result jsonb; target uuid;
 old_task journal.tasks%rowtype; parent journal.plans%rowtype; tag_name text; tag_uuid uuid;
 prior_tags jsonb;
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0
   or jsonb_typeof(p_payload) is distinct from 'object' then
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
 if p_command in ('create_task','update_task') and p_payload ? 'tags' then
   if jsonb_typeof(p_payload->'tags') is distinct from 'array' then
     raise exception 'Invalid tags' using errcode='22023'; end if;
   if jsonb_array_length(p_payload->'tags')>20 or exists(
     select 1 from jsonb_array_elements(p_payload->'tags') a(value)
     where jsonb_typeof(value)<>'string' or length(btrim(value#>>'{}')) not between 1 and 30
   ) then raise exception 'Invalid tags' using errcode='22023'; end if;
 end if;
 if p_command='create_plan' then
   if p_payload->>'kind' is distinct from 'general' then
     raise exception 'Only general plan creation is enabled' using errcode='22023'; end if;
   insert into journal.plans(diary_id,kind,title,start_date,end_date,success_text,estimated_minutes,priority)
   values(p_diary_id,'general',btrim(p_payload->>'title'),(p_payload->>'startDate')::date,
     (p_payload->>'endDate')::date,coalesce(p_payload->>'successText',''),
     coalesce((p_payload->>'estimatedMinutes')::integer,0),coalesce(p_payload->>'priority','normal')) returning id into target;
 elsif p_command='update_plan' then
   select * into parent from journal.plans where diary_id=p_diary_id
     and id=(p_payload->>'planId')::uuid and deleted_at is null;
   if not found or parent.kind<>'general' then raise exception 'Active general plan required' using errcode='22023'; end if;
   target:=parent.id;
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value)
     values(p_diary_id,'plan',target,to_jsonb(parent));
   update journal.plans set title=btrim(p_payload->>'title'),start_date=(p_payload->>'startDate')::date,
     end_date=(p_payload->>'endDate')::date,success_text=coalesce(p_payload->>'successText',parent.success_text),
     estimated_minutes=coalesce((p_payload->>'estimatedMinutes')::integer,parent.estimated_minutes),
     priority=coalesce(p_payload->>'priority',parent.priority),updated_at=now() where id=target;
 elsif p_command='create_task' then
   select * into parent from journal.plans where diary_id=p_diary_id
     and id=(p_payload->>'planId')::uuid and deleted_at is null;
   if not found or parent.kind<>'general' then raise exception 'Active general plan required' using errcode='22023'; end if;
   insert into journal.tasks(diary_id,plan_id,title,due_date,estimated_minutes,priority,description)
   values(p_diary_id,parent.id,btrim(p_payload->>'title'),nullif(p_payload->>'dueDate','')::date,
     coalesce((p_payload->>'estimatedMinutes')::integer,0),coalesce(p_payload->>'priority','normal'),
     coalesce(p_payload->>'description','')) returning id into target;
 elsif p_command in ('update_task','set_task_complete') then
   select * into old_task from journal.tasks where diary_id=p_diary_id
     and id=(p_payload->>'taskId')::uuid and deleted_at is null;
   if not found then raise exception 'Active task required' using errcode='22023'; end if;
   if not exists(select 1 from journal.plans where id=old_task.plan_id and diary_id=p_diary_id and deleted_at is null)
     then raise exception 'Active plan required' using errcode='22023'; end if;
   target:=old_task.id;
   select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name,g.id),'[]'::jsonb)
     into prior_tags from journal.task_tags l join journal.tags g on (g.diary_id,g.id)=(l.diary_id,l.tag_id)
     where l.diary_id=p_diary_id and l.task_id=target;
   if p_command='set_task_complete' then
     if jsonb_typeof(p_payload->'complete') is distinct from 'boolean' then
       raise exception 'Boolean required' using errcode='22023'; end if;
     if old_task.complete=(p_payload->>'complete')::boolean then
       result:=jsonb_build_object('revision',rev,'entityId',target);
       insert into journal.command_receipts(diary_id,request_id,request,result) values(p_diary_id,p_request_id,req,result);
       return result;
     end if;
   end if;
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value)
     values(p_diary_id,'task',target,to_jsonb(old_task)||jsonb_build_object('tags',prior_tags));
   if p_command='update_task' then
     update journal.tasks set title=btrim(p_payload->>'title'),description=coalesce(p_payload->>'description',old_task.description),
       due_date=case when p_payload ? 'dueDate' then nullif(p_payload->>'dueDate','')::date else old_task.due_date end,
       estimated_minutes=coalesce((p_payload->>'estimatedMinutes')::integer,old_task.estimated_minutes),
       priority=coalesce(p_payload->>'priority',old_task.priority),updated_at=now() where id=target;
   else
     update journal.tasks set complete=(p_payload->>'complete')::boolean,
       completed_at=case when (p_payload->>'complete')::boolean then coalesce(completed_at,now()) else null end,
       updated_at=now() where id=target;
   end if;
 else raise exception 'Unsupported command' using errcode='22023'; end if;
 if p_command in ('create_task','update_task') and p_payload ? 'tags' then
   delete from journal.task_tags where diary_id=p_diary_id and task_id=target;
   for tag_name in select distinct btrim(value) from jsonb_array_elements_text(p_payload->'tags') loop
     insert into journal.tags(diary_id,name) values(p_diary_id,tag_name)
       on conflict(diary_id,name) do update set name=excluded.name returning id into tag_uuid;
     insert into journal.task_tags(diary_id,task_id,tag_id) values(p_diary_id,target,tag_uuid);
   end loop;
 end if;
 update journal.diaries set revision=revision+1 where id=p_diary_id returning revision into rev;
 result:=jsonb_build_object('revision',rev,'entityId',target);
 insert into journal.command_receipts(diary_id,request_id,request,result) values(p_diary_id,p_request_id,req,result);
 return result;
end;$$;
revoke all on function public.journal_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.journal_command(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.journal_snapshot(uuid) to service_role;
grant execute on function public.journal_command(uuid,uuid,bigint,text,jsonb) to service_role;
commit;
