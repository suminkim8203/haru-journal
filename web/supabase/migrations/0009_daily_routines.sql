-- Daily rules and date-specific tasks. No cumulative routine completion metric.
begin;
do $$declare c record;begin
 if exists(select 1 from journal.plans where start_date is null or end_date is null) then raise exception 'Legacy plan dates require user input before migration' using errcode='22023';end if;
 for c in select conname from pg_constraint where conrelid='journal.plans'::regclass and contype='c' and pg_get_constraintdef(oid) like '%kind%start_date%' loop
  execute format('alter table journal.plans drop constraint %I',c.conname);
 end loop;
end $$;
alter table journal.plans add constraint plans_period_required check(start_date is not null and end_date is not null and end_date>=start_date);
create table journal.routine_rules(
 id uuid primary key default gen_random_uuid(),diary_id uuid not null references journal.diaries(id),plan_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 120),description text not null default '' check(length(description)<=4000),
 start_date date not null,end_date date not null,estimated_minutes integer not null check(estimated_minutes between 1 and 10080),
 priority text not null check(priority in ('high','normal','low')),tags jsonb not null default '[]' check(jsonb_typeof(tags)='array'),
 timing text not null check(timing in ('flex','fixed')),start_time time,stopped_from date,deleted_at timestamptz,
 unique(diary_id,id),unique(diary_id,id,plan_id),foreign key(diary_id,plan_id) references journal.plans(diary_id,id),check(end_date>=start_date),
 check((timing='flex' and start_time is null) or (timing='fixed' and start_time is not null))
);
alter table journal.routine_rules enable row level security;
revoke all on journal.routine_rules from public,anon,authenticated;
alter table journal.tasks add column routine_id uuid,add column occurrence_date date,add column routine_exception boolean not null default false,
 add column skipped boolean not null default false,add column cancelled_at timestamptz;
alter table journal.tasks add constraint tasks_routine_fk foreign key(diary_id,routine_id,plan_id) references journal.routine_rules(diary_id,id,plan_id);
alter table journal.tasks add constraint tasks_occurrence_pair check((routine_id is null and occurrence_date is null) or (routine_id is not null and occurrence_date is not null and due_date is not null and due_date=occurrence_date));
create unique index routine_occurrence_unique on journal.tasks(diary_id,routine_id,occurrence_date) where routine_id is not null;
alter table journal.trash drop constraint trash_entity_type_check;
alter table journal.trash add constraint trash_entity_type_check check(entity_type in ('plan','task','run','placement','reflection','routine'));

create function journal.routine_protected(t journal.tasks) returns boolean language sql stable set search_path='' as $$
 select t.deleted_at is not null or t.occurrence_date<(now() at time zone 'Asia/Seoul')::date or t.complete or t.routine_exception or t.skipped or t.cancelled_at is not null
 or exists(select 1 from journal.runs r where r.diary_id=t.diary_id and r.task_id=t.id);
$$;
create function journal.set_task_tags(d uuid,t uuid,names jsonb) returns void language plpgsql set search_path='' as $$
declare tag_name text;tag uuid;begin
 delete from journal.task_tags where diary_id=d and task_id=t;
 for tag_name in select value from jsonb_array_elements_text(names) loop
  insert into journal.tags(diary_id,name) values(d,tag_name) on conflict(diary_id,name) do update set name=excluded.name returning id into tag;
  insert into journal.task_tags(diary_id,task_id,tag_id) values(d,t,tag);
 end loop;
end $$;
create function journal.routine_placement(d uuid,t uuid,day date,p jsonb) returns void language plpgsql set search_path='' as $$
declare a timestamptz;b timestamptz;begin
 if p->>'timing'='flex' then return;end if;
 a:=(day+(p->>'time')::time) at time zone 'Asia/Seoul';b:=a+make_interval(mins=>(p->>'estimatedMinutes')::integer);
 if not coalesce((p->>'allowOverlap')::boolean,false) and exists(select 1 from journal.placements x where x.diary_id=d and x.deleted_at is null and x.started_at<b and x.ended_at>a) then raise exception 'Routine placements overlap; explicit confirmation required' using errcode='22023';end if;
 insert into journal.placements(diary_id,task_id,started_at,ended_at) values(d,t,a,b);
end $$;
create function journal.make_occurrence(d uuid,r journal.routine_rules,day date,p jsonb) returns uuid language plpgsql set search_path='' as $$
declare t uuid;begin
 insert into journal.tasks(diary_id,plan_id,title,description,due_date,estimated_minutes,priority,routine_id,occurrence_date)
 values(d,r.plan_id,btrim(p->>'title'),coalesce(p->>'description',''),day,(p->>'estimatedMinutes')::int,coalesce(p->>'priority','normal'),r.id,day) returning id into t;
 perform journal.set_task_tags(d,t,coalesce(p->'tags','[]'));perform journal.routine_placement(d,t,day,p);return t;
end $$;

-- Keep the v5 historical read, adding rule/occurrence fields from existing rows.
alter function public.haru_snapshot() rename to snapshot_v5;
alter function public.snapshot_v5() set schema journal;
revoke all on function journal.snapshot_v5() from public,anon,authenticated,service_role;
create function public.haru_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select journal.snapshot_v5()||jsonb_build_object('schemaVersion',6,'trash',coalesce((select jsonb_agg(jsonb_build_object('id',tr.id,'entity_type',tr.entity_type,'entity_id',tr.entity_id,'title',tr.title,'deleted_at',tr.deleted_at,'placement_conflict',exists(select 1 from journal.placements restored join journal.placements active on active.diary_id=restored.diary_id and active.id<>restored.id and active.deleted_at is null and active.started_at<restored.ended_at and active.ended_at>restored.started_at where restored.diary_id=tr.diary_id and restored.deleted_at=tr.deleted_at and restored.id in(select value::uuid from jsonb_array_elements_text(coalesce(tr.batch->'placementIds','[]'))))) order by tr.deleted_at desc,tr.id) from journal.trash tr where tr.diary_id='00000000-0000-4000-8000-000000000006'::uuid and tr.restored_at is null),'[]'::jsonb),'routines',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('occurrences',coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'date',k.occurrence_date,'reason',case when k.deleted_at is not null then '삭제됨' when k.occurrence_date<(now() at time zone 'Asia/Seoul')::date then '지난 날짜' when k.complete then '완료' when exists(select 1 from journal.runs x where x.diary_id=k.diary_id and x.task_id=k.id) then '실행 이력 있음' when k.routine_exception then '개별 수정' when k.skipped then '건너뛰기' when k.cancelled_at is not null then '반복 제외·중단' else '' end) order by k.occurrence_date,k.id) from journal.tasks k where k.diary_id=r.diary_id and k.routine_id=r.id),'[]'::jsonb)) order by r.start_date,r.id)
 from journal.routine_rules r join journal.plans p on (p.diary_id,p.id)=(r.diary_id,r.plan_id) where r.diary_id='00000000-0000-4000-8000-000000000006'::uuid and r.deleted_at is null and p.deleted_at is null),'[]'::jsonb));
$$;
create or replace function public.haru_export() returns jsonb language sql stable security definer set search_path='' as $$
 select journal.export_v4('00000000-0000-4000-8000-000000000006'::uuid)||jsonb_build_object('schemaVersion',6,'routines',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from journal.routine_rules r where r.diary_id='00000000-0000-4000-8000-000000000006'::uuid),'[]'::jsonb));
$$;

create or replace function public.haru_command(p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d constant uuid:='00000000-0000-4000-8000-000000000006';p jsonb:=p_payload;req jsonb;receipt journal.command_receipts%rowtype;rev bigint;result jsonb;
 rule journal.routine_rules%rowtype;parent journal.plans%rowtype;t journal.tasks%rowtype;entry journal.trash%rowtype;
 target uuid;first_date date;last_date date;day date;moment timestamptz:=now();ids uuid[]:='{}';blocks uuid[]:='{}';old_rules uuid[];old_json jsonb;name text;
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740991 or jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>32768 then raise exception 'Invalid envelope' using errcode='22023';end if;
 -- Normalize first, before both new writes and exact-retry comparisons.
 if p_command in ('create_routine','update_routine') then
  p:=journal.validate_command('create_task',p||jsonb_build_object('planId',coalesce(p->>'planId',d::text)));
  perform journal.require_field(p,'startDate','date');perform journal.require_field(p,'endDate','date');perform journal.require_field(p,'estimatedMinutes','integer',true,10080);perform journal.require_field(p,'allowOverlap','boolean',false);
  if p->>'startDate'>p->>'endDate' or (p->>'estimatedMinutes')::int<1 or p->>'timing' is null or p->>'timing' not in ('flex','fixed') then raise exception 'Invalid routine' using errcode='22023';end if;
  if p->>'timing'='fixed' and (p->>'time' is null or p->>'time'!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Invalid daily time' using errcode='22023';end if;
  if p_command='update_routine' then perform journal.require_field(p,'routineId','uuid');end if;
 elsif p_command in ('skip_occurrence','stop_routine') then
  perform journal.require_field(p,case when p_command='skip_occurrence' then 'taskId' else 'routineId' end,'uuid');if p_command='stop_routine' then perform journal.require_field(p,'fromDate','date');end if;
 elsif p_command='create_plan' and p->>'kind'='routine' then
  if p?'sourcePlanId' then raise exception 'Improvements target general plans' using errcode='22023';end if;
  p:=journal.validate_command(p_command,p||jsonb_build_object('kind','general'))||jsonb_build_object('kind','routine');
 else p:=journal.validate_command(p_command,p);if p_command='restore_entity' then perform journal.require_field(p,'allowOverlap','boolean',false);end if;end if;
 select revision into rev from journal.diaries where id=d for update;
 req:=jsonb_build_object('command',p_command,'payload',p,'expectedRevision',p_expected_revision);
 select * into receipt from journal.command_receipts where diary_id=d and request_id=p_request_id;
 if found then if receipt.request<>req then raise exception 'Request ID reused with different content' using errcode='P0002';end if;return receipt.result;end if;
 if rev<>p_expected_revision then raise exception 'Revision conflict' using errcode='P0001';end if;
 if p_command='create_plan' and p->>'kind'='routine' then
  insert into journal.plans(diary_id,kind,title,start_date,end_date,priority,success_text,estimated_minutes) values(d,'routine',btrim(p->>'title'),(p->>'startDate')::date,(p->>'endDate')::date,coalesce(p->>'priority','normal'),coalesce(p->>'successText',''),coalesce((p->>'estimatedMinutes')::int,0)) returning id into target;
 elsif p_command='update_plan' then
  select * into parent from journal.plans where diary_id=d and id=(p->>'planId')::uuid and deleted_at is null;
  if not found then raise exception 'Active plan required' using errcode='22023';end if;
  if exists(select 1 from journal.routine_rules r where r.diary_id=d and r.plan_id=parent.id and r.deleted_at is null and (r.start_date<(p->>'startDate')::date or r.end_date>(p->>'endDate')::date)) then raise exception 'Plan period must contain its routine rules' using errcode='22023';end if;
  if parent.kind='general' then return journal.core_command_v5(d,p_request_id,p_expected_revision,p_command,p);end if;
  target:=parent.id;insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(d,'plan',target,to_jsonb(parent));
  update journal.plans set title=btrim(p->>'title'),start_date=(p->>'startDate')::date,end_date=(p->>'endDate')::date,success_text=coalesce(p->>'successText',success_text),estimated_minutes=coalesce((p->>'estimatedMinutes')::int,estimated_minutes),priority=coalesce(p->>'priority',priority),updated_at=moment where diary_id=d and id=target;
 elsif p_command in ('create_routine','update_routine') then
  first_date:=(p->>'startDate')::date;last_date:=(p->>'endDate')::date;
  if p_command='create_routine' then
   select * into parent from journal.plans where diary_id=d and id=(p->>'planId')::uuid and deleted_at is null and kind='routine';
  else
   select * into rule from journal.routine_rules where diary_id=d and id=(p->>'routineId')::uuid and deleted_at is null;
   if not found or first_date<rule.start_date or first_date>rule.end_date then raise exception 'Active routine and change date required' using errcode='22023';end if;
   select * into parent from journal.plans where diary_id=d and id=rule.plan_id and deleted_at is null;
  end if;
  if parent.id is null then raise exception 'Active routine plan required' using errcode='22023';end if;
  if first_date<parent.start_date or last_date>parent.end_date then
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(d,'plan',parent.id,to_jsonb(parent));
   update journal.plans set start_date=least(start_date,first_date),end_date=greatest(end_date,last_date),updated_at=moment where diary_id=d and id=parent.id;
  end if;
  if p_command='create_routine' then
   insert into journal.routine_rules(diary_id,plan_id,title,description,start_date,end_date,estimated_minutes,priority,tags,timing,start_time)
   values(d,parent.id,btrim(p->>'title'),coalesce(p->>'description',''),first_date,last_date,(p->>'estimatedMinutes')::int,coalesce(p->>'priority','normal'),coalesce(p->'tags','[]'),p->>'timing',case when p->>'timing'='fixed' then (p->>'time')::time end) returning * into rule;
   for day in select first_date+i from generate_series(0,last_date-first_date) i loop perform journal.make_occurrence(d,rule,day,p);end loop;
  else
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(d,'routine',rule.id,to_jsonb(rule));
   select coalesce(array_agg(k.id),'{}') into ids from journal.tasks k where k.diary_id=d and k.routine_id=rule.id and k.occurrence_date>=first_date and not journal.routine_protected(k);
   -- Remove the target placements as a batch before checking new placements.
   select coalesce(array_agg(id),'{}') into blocks from journal.placements where diary_id=d and task_id=any(ids) and deleted_at is null;
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) select d,'placement',id,to_jsonb(x) from journal.placements x where x.diary_id=d and x.id=any(blocks);
   update journal.placements set deleted_at=moment where diary_id=d and id=any(blocks);
   for t in select * from journal.tasks where diary_id=d and id=any(ids) loop
    insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(d,'task',t.id,to_jsonb(t)||jsonb_build_object('tags',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name,g.id),'[]'::jsonb) from journal.task_tags link join journal.tags g on g.diary_id=link.diary_id and g.id=link.tag_id where link.diary_id=d and link.task_id=t.id)));
    if t.occurrence_date>last_date then update journal.tasks set cancelled_at=moment where diary_id=d and id=t.id;
    else update journal.tasks set title=btrim(p->>'title'),description=coalesce(p->>'description',description),estimated_minutes=(p->>'estimatedMinutes')::int,priority=coalesce(p->>'priority',priority),updated_at=moment where diary_id=d and id=t.id;
     perform journal.set_task_tags(d,t.id,coalesce(p->'tags','[]'));perform journal.routine_placement(d,t.id,t.occurrence_date,p);
    end if;
   end loop;
   if exists(select 1 from journal.tasks where diary_id=d and id=any(ids) and cancelled_at=moment) then
    insert into journal.trash(diary_id,entity_type,entity_id,title,deleted_at,batch) values(d,'routine',rule.id,rule.title||' · 기간에서 제외',moment,jsonb_build_object('operation','exclude','taskIds',(select coalesce(jsonb_agg(id),'[]') from journal.tasks where diary_id=d and id=any(ids) and cancelled_at=moment),'placementIds',(select coalesce(jsonb_agg(x.id),'[]') from journal.placements x join journal.tasks k on (k.diary_id,k.id)=(x.diary_id,x.task_id) where x.diary_id=d and x.id=any(blocks) and k.cancelled_at=moment)));
   end if;
   for day in select first_date+i from generate_series(0,last_date-first_date) i where first_date+i>=(now() at time zone 'Asia/Seoul')::date loop
    if (rule.stopped_from is null or day<rule.stopped_from) and not exists(select 1 from journal.tasks k where k.diary_id=d and k.routine_id=rule.id and k.occurrence_date=day) then perform journal.make_occurrence(d,rule,day,p);end if;
   end loop;
   update journal.routine_rules set title=btrim(p->>'title'),description=coalesce(p->>'description',description),end_date=last_date,estimated_minutes=(p->>'estimatedMinutes')::int,priority=coalesce(p->>'priority',priority),tags=coalesce(p->'tags','[]'),timing=p->>'timing',start_time=case when p->>'timing'='fixed' then (p->>'time')::time end where diary_id=d and id=rule.id;
  end if;target:=rule.id;
 elsif p_command in ('skip_occurrence','stop_routine') then
  if p_command='skip_occurrence' then
   select * into t from journal.tasks where diary_id=d and id=(p->>'taskId')::uuid and deleted_at is null and routine_id is not null and not complete and cancelled_at is null and not skipped;
   if not found then raise exception 'Eligible occurrence required' using errcode='22023';end if;
   if exists(select 1 from journal.runs where diary_id=d and task_id=t.id and ended_at is null and deleted_at is null) then raise exception 'End recording before skipping' using errcode='22023';end if;
   select * into rule from journal.routine_rules where diary_id=d and id=t.routine_id and deleted_at is null;ids:=array[t.id];
  else
   select * into rule from journal.routine_rules where diary_id=d and id=(p->>'routineId')::uuid and deleted_at is null;
   if not found or rule.stopped_from is not null or (p->>'fromDate')::date<rule.start_date or (p->>'fromDate')::date>rule.end_date then raise exception 'Eligible routine stop date required' using errcode='22023';end if;
   select coalesce(array_agg(k.id),'{}') into ids from journal.tasks k where k.diary_id=d and k.routine_id=rule.id and k.occurrence_date>=(p->>'fromDate')::date and not journal.routine_protected(k);
  end if;
  if rule.id is null or not exists(select 1 from journal.plans where diary_id=d and id=rule.plan_id and deleted_at is null) then raise exception 'Active parent required' using errcode='22023';end if;
  insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(d,'routine',rule.id,to_jsonb(rule));
  select coalesce(array_agg(id),'{}') into blocks from journal.placements where diary_id=d and task_id=any(ids) and deleted_at is null;
  insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) select d,'task',id,to_jsonb(k) from journal.tasks k where k.diary_id=d and k.id=any(ids);
  update journal.tasks set skipped=case when p_command='skip_occurrence' then true else skipped end,cancelled_at=case when p_command='stop_routine' then moment else cancelled_at end where diary_id=d and id=any(ids);
  update journal.placements set deleted_at=moment where diary_id=d and id=any(blocks);
  insert into journal.trash(diary_id,entity_type,entity_id,title,deleted_at,batch) values(d,'routine',rule.id,rule.title||case when p_command='skip_occurrence' then ' · 날짜 건너뛰기' else ' · 이후 반복 중단' end,moment,jsonb_build_object('operation',p_command,'taskIds',to_jsonb(ids),'placementIds',to_jsonb(blocks),'previousStop',rule.stopped_from));
  if p_command='stop_routine' then update journal.routine_rules set stopped_from=(p->>'fromDate')::date where diary_id=d and id=rule.id;end if;target:=rule.id;
 elsif p_command='restore_entity' and exists(select 1 from journal.trash where diary_id=d and id=(p->>'trashId')::uuid and restored_at is null and entity_type='routine') then
  select * into entry from journal.trash where diary_id=d and id=(p->>'trashId')::uuid and restored_at is null;
  select * into rule from journal.routine_rules where diary_id=d and id=entry.entity_id and deleted_at is null;
  if rule.id is null or not exists(select 1 from journal.plans where diary_id=d and id=rule.plan_id and deleted_at is null) then raise exception 'Restore parent first' using errcode='22023';end if;
  if not coalesce((p->>'allowOverlap')::boolean,false) and exists(select 1 from journal.placements restored join journal.placements active on active.diary_id=restored.diary_id and active.deleted_at is null and active.id<>restored.id and active.started_at<restored.ended_at and active.ended_at>restored.started_at where restored.diary_id=d and restored.id in(select value::uuid from jsonb_array_elements_text(entry.batch->'placementIds'))) then raise exception 'Restored placements overlap; resolve before restoring' using errcode='22023';end if;
  update journal.tasks set skipped=case when entry.batch->>'operation'='skip_occurrence' then false else skipped end,cancelled_at=case when cancelled_at=entry.deleted_at then null else cancelled_at end,routine_exception=true where diary_id=d and deleted_at is null and id in(select value::uuid from jsonb_array_elements_text(entry.batch->'taskIds'));
  update journal.placements set deleted_at=null where diary_id=d and deleted_at=entry.deleted_at and id in(select value::uuid from jsonb_array_elements_text(entry.batch->'placementIds'));
  if entry.batch->>'operation'='stop_routine' then update journal.routine_rules set stopped_from=(entry.batch->>'previousStop')::date where diary_id=d and id=rule.id;end if;
  update journal.trash set restored_at=moment where diary_id=d and id=entry.id;target:=rule.id;
 else
  -- Ordinary date-specific edits become exceptions; actual writes preserve dates.
  if p_command in ('set_task_complete','start_run','create_placement','update_placement','update_task') then
   select * into t from journal.tasks where diary_id=d and id=(p->>'taskId')::uuid;
   if t.skipped or t.cancelled_at is not null then raise exception 'Restore excluded occurrence first' using errcode='22023';end if;
   if p_command='update_task' and t.routine_id is not null and p?'dueDate' and p->>'dueDate' is distinct from t.occurrence_date::text then raise exception 'Occurrence date is fixed' using errcode='22023';end if;
  end if;
  if p_command='delete_entity' and p->>'entityType'='plan' then
   select coalesce(array_agg(id),'{}') into old_rules from journal.routine_rules where diary_id=d and plan_id=(p->>'entityId')::uuid and deleted_at is null;
  end if;
  if p_command='restore_entity' then
   select * into entry from journal.trash where diary_id=d and id=(p->>'trashId')::uuid and restored_at is null;
   if not coalesce((p->>'allowOverlap')::boolean,false) and exists(select 1 from journal.placements restored join journal.placements active on active.diary_id=restored.diary_id and active.id<>restored.id and active.deleted_at is null and active.started_at<restored.ended_at and active.ended_at>restored.started_at where restored.diary_id=d and restored.deleted_at=entry.deleted_at and restored.id in(select value::uuid from jsonb_array_elements_text(coalesce(entry.batch->'placementIds','[]')))) then raise exception 'Restored placements overlap; explicit confirmation required' using errcode='22023';end if;
  end if;
  result:=journal.core_command_v5(d,p_request_id,p_expected_revision,p_command,p);
  if p_command='delete_entity' and p->>'entityType'='plan' then
   update journal.routine_rules set deleted_at=coalesce((p->>'at')::timestamptz,moment) where diary_id=d and id=any(old_rules);
   update journal.trash set batch=batch||jsonb_build_object('routineIds',to_jsonb(old_rules)) where diary_id=d and entity_type='plan' and entity_id=(p->>'entityId')::uuid and restored_at is null;
  elsif p_command='restore_entity' then
   select * into entry from journal.trash where diary_id=d and id=(p->>'trashId')::uuid;
   if entry.entity_type='plan' then update journal.routine_rules set deleted_at=null where diary_id=d and deleted_at=entry.deleted_at and id in(select value::uuid from jsonb_array_elements_text(coalesce(entry.batch->'routineIds','[]')));end if;
  elsif p_command in ('update_task','create_placement','update_placement') then update journal.tasks set routine_exception=true where diary_id=d and id=(p->>'taskId')::uuid and routine_id is not null;
  elsif p_command='delete_entity' and p->>'entityType'='placement' then update journal.tasks set routine_exception=true where diary_id=d and routine_id is not null and id=(select task_id from journal.placements where diary_id=d and id=(p->>'entityId')::uuid);end if;
  return result;
 end if;
 update journal.diaries set revision=revision+1 where id=d returning revision into rev;
 result:=jsonb_build_object('revision',rev,'entityId',target);insert into journal.command_receipts(diary_id,request_id,request,result) values(d,p_request_id,req,result);return result;
end $$;
revoke all on function journal.routine_protected(journal.tasks),journal.set_task_tags(uuid,uuid,jsonb),journal.routine_placement(uuid,uuid,date,jsonb),journal.make_occurrence(uuid,journal.routine_rules,date,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.haru_snapshot() from public;
grant execute on function public.haru_snapshot() to anon,authenticated;
notify pgrst,'reload schema';
commit;
