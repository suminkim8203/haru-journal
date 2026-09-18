-- Preserve real work and thoughts when their planning source is deleted.
-- Applied migrations are immutable. This replacement keeps existing receipts/IDs.
begin;
create function journal.core_command_v5(p_diary_id uuid,p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare rev bigint;req jsonb;result jsonb;receipt journal.command_receipts%rowtype;target uuid;day date;moment timestamptz;
 old_value jsonb;import_data jsonb;item journal.trash%rowtype;parent uuid;name text;task_ids uuid[];run_ids uuid[];placement_ids uuid[];active_run journal.runs%rowtype;
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid command envelope' using errcode='22023'; end if;
 select revision into rev from journal.diaries where id=p_diary_id for update;
 if not found then raise exception 'Diary missing' using errcode='22023'; end if;
 req:=jsonb_build_object('command',p_command,'payload',p_payload,'expectedRevision',p_expected_revision);
 select * into receipt from journal.command_receipts where diary_id=p_diary_id and request_id=p_request_id;
 if found then if receipt.request<>req then raise exception 'Request ID reused with different content' using errcode='P0002'; end if;return receipt.result;end if;
 if rev<>p_expected_revision then raise exception 'Revision conflict' using errcode='P0001';end if;
 if p_command='create_plan' and p_payload?'sourcePlanId' then
  if not exists(select 1 from journal.plans where diary_id=p_diary_id and id=(p_payload->>'sourcePlanId')::uuid and deleted_at is null and kind='general') then raise exception 'Active source plan required' using errcode='22023';end if;
  result:=journal.core_command_v3(p_diary_id,p_request_id,p_expected_revision,p_command,p_payload);
  insert into journal.improvements(diary_id,source_plan_id,target_plan_id,source_plan_title,source_text)
   select p_diary_id,id,(result->>'entityId')::uuid,title,btrim(p_payload->>'improvementText') from journal.plans where diary_id=p_diary_id and id=(p_payload->>'sourcePlanId')::uuid;
  return result;
 end if;
 if p_command not in ('save_thought','save_reflection','close_day','bookmark_reflection','send_improvement','delete_entity','restore_entity') then
  return journal.core_command_v3(p_diary_id,p_request_id,p_expected_revision,p_command,p_payload);end if;
 if p_command in ('save_thought','save_reflection','close_day') then day:=(p_payload->>'date')::date;if day is null then raise exception 'Date required' using errcode='22023';end if;end if;
 if p_command='save_thought' then
  parent:=(p_payload->>'taskId')::uuid;
  if not exists(select 1 from journal.tasks t join journal.plans p on (p.diary_id,p.id)=(t.diary_id,t.plan_id) where t.diary_id=p_diary_id and t.id=parent and t.deleted_at is null and p.deleted_at is null) then raise exception 'Active task required' using errcode='22023';end if;
  if not exists(select 1 from journal.runs r join journal.segments s on (s.diary_id,s.run_id)=(r.diary_id,r.id)
   where r.diary_id=p_diary_id and r.task_id=parent and r.deleted_at is null and s.kind='work'
   and s.started_at<((day+1)::timestamp at time zone 'Asia/Seoul') and coalesce(s.ended_at,now())>(day::timestamp at time zone 'Asia/Seoul')
   and coalesce(s.ended_at,now())>s.started_at) then raise exception 'Performed task required for this date' using errcode='22023';end if;
  select to_jsonb(t) into old_value from journal.thoughts t where diary_id=p_diary_id and task_id=parent and local_date=day;
  if old_value is not null then insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(p_diary_id,'thought',(old_value->>'id')::uuid,old_value);end if;
  insert into journal.thoughts(diary_id,task_id,local_date,body) values(p_diary_id,parent,day,btrim(p_payload->>'body')) on conflict(diary_id,task_id,local_date)
   do update set body=excluded.body,updated_at=now() returning id into target;
 elsif p_command in ('save_reflection','close_day') then
  if p_command='save_reflection' or length(btrim(coalesce(p_payload->>'body','')))>0 then
   if jsonb_typeof(coalesce(p_payload->'imports','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_payload->'imports','[]'::jsonb))>500 then raise exception 'Invalid imports' using errcode='22023';end if;
   if exists(select 1 from jsonb_array_elements(coalesce(p_payload->'imports','[]'::jsonb)) part where not exists(select 1 from journal.thoughts t
    where t.diary_id=p_diary_id and t.local_date=day and t.id=(part->>'id')::uuid and t.body=part->>'body')
    and not exists(select 1 from journal.reflections f where f.diary_id=p_diary_id and f.local_date=day and f.imported_thoughts @> jsonb_build_array(part))) then raise exception 'Source thought changed' using errcode='22023';end if;
   select to_jsonb(r) into old_value from journal.reflections r where diary_id=p_diary_id and local_date=day;
   if old_value is not null then
    if old_value->>'deleted_at' is not null then raise exception 'Restore deleted reflection first' using errcode='22023';end if;
    insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(p_diary_id,'reflection',(old_value->>'id')::uuid,old_value);
   end if;
   select coalesce(jsonb_agg(coalesce((select original from journal.reflections f,
    lateral jsonb_array_elements(f.imported_thoughts) original where f.diary_id=p_diary_id and f.local_date=day and original->>'id'=part->>'id' and original->>'body'=part->>'body' limit 1),
    jsonb_build_object('id',t.id,'body',t.body,'task_title',k.title,'plan_title',p.title))),'[]'::jsonb) into import_data
    from jsonb_array_elements(coalesce(p_payload->'imports','[]'::jsonb)) part join journal.thoughts t on t.diary_id=p_diary_id and t.id=(part->>'id')::uuid
    join journal.tasks k on (k.diary_id,k.id)=(t.diary_id,t.task_id) join journal.plans p on (p.diary_id,p.id)=(k.diary_id,k.plan_id);
   insert into journal.reflections(diary_id,local_date,body,imported_thoughts) values(p_diary_id,day,btrim(p_payload->>'body'),import_data) on conflict(diary_id,local_date)
    do update set body=excluded.body,imported_thoughts=case when p_payload?'imports' then excluded.imported_thoughts else journal.reflections.imported_thoughts end,updated_at=now() returning id into target;
  end if;
  if p_command='close_day' then insert into journal.day_closures(diary_id,local_date) values(p_diary_id,day) on conflict do nothing;end if;
 elsif p_command='bookmark_reflection' then
  if jsonb_typeof(p_payload->'bookmarked') is distinct from 'boolean' then raise exception 'Boolean required' using errcode='22023';end if;
  update journal.reflections set bookmarked=(p_payload->>'bookmarked')::boolean where diary_id=p_diary_id and id=(p_payload->>'reflectionId')::uuid and deleted_at is null returning id into target;
  if not found then raise exception 'Active reflection required' using errcode='22023';end if;
 elsif p_command='send_improvement' then
  if (select count(*) from journal.plans where diary_id=p_diary_id and id in ((p_payload->>'sourcePlanId')::uuid,(p_payload->>'targetPlanId')::uuid) and deleted_at is null and kind='general')<>2 then raise exception 'Two active distinct general plans required' using errcode='22023';end if;
  insert into journal.improvements(diary_id,source_plan_id,target_plan_id,source_plan_title,source_text)
   select p_diary_id,(p_payload->>'sourcePlanId')::uuid,(p_payload->>'targetPlanId')::uuid,title,btrim(p_payload->>'body') from journal.plans where diary_id=p_diary_id and id=(p_payload->>'sourcePlanId')::uuid
   on conflict(diary_id,source_plan_id,target_plan_id,source_text) do update set source_text=excluded.source_text returning id into target;
 elsif p_command='delete_entity' then
  name:=p_payload->>'entityType';target:=(p_payload->>'entityId')::uuid;moment:=coalesce((p_payload->>'at')::timestamptz,now());
  if name not in ('plan','task','run','placement','reflection') then raise exception 'Invalid deletion type' using errcode='22023';end if;
  execute format('select to_jsonb(t) from journal.%I t where diary_id=$1 and id=$2 and deleted_at is null',case name when 'plan' then 'plans' when 'task' then 'tasks' when 'run' then 'runs' when 'placement' then 'placements' else 'reflections' end) into old_value using p_diary_id,target;
  if old_value is null then raise exception 'Active entity required' using errcode='22023';end if;
  if name in ('plan','task') then
   select coalesce(array_agg(id),'{}') into task_ids from journal.tasks where diary_id=p_diary_id and deleted_at is null and (case when name='plan' then plan_id=target else id=target end);
   select coalesce(array_agg(id),'{}') into run_ids from journal.runs where diary_id=p_diary_id and task_id=any(task_ids) and deleted_at is null;
   select coalesce(array_agg(id),'{}') into placement_ids from journal.placements where diary_id=p_diary_id and task_id=any(task_ids) and deleted_at is null;
  elsif name='run' then run_ids:=array[target];elsif name='placement' then placement_ids:=array[target];end if;
  for active_run in select * from journal.runs where diary_id=p_diary_id and id=any(run_ids) and ended_at is null loop
   if moment<=active_run.started_at or moment<(select max(started_at) from journal.segments where diary_id=p_diary_id and run_id=active_run.id) then raise exception 'Invalid deletion end' using errcode='22023';end if;
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(p_diary_id,'run',active_run.id,to_jsonb(active_run)||jsonb_build_object('segments',(select jsonb_agg(to_jsonb(s)) from journal.segments s where s.diary_id=p_diary_id and s.run_id=active_run.id)));
   update journal.segments set ended_at=moment where diary_id=p_diary_id and run_id=active_run.id and ended_at is null;update journal.runs set ended_at=moment where diary_id=p_diary_id and id=active_run.id;
  end loop;
  insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(p_diary_id,name,target,old_value);
  if name='plan' then update journal.plans set deleted_at=moment where diary_id=p_diary_id and id=target;end if;
  update journal.tasks set deleted_at=moment where diary_id=p_diary_id and id=any(task_ids);
  if name='run' then update journal.runs set deleted_at=moment where diary_id=p_diary_id and id=any(run_ids);end if;
  update journal.placements set deleted_at=moment where diary_id=p_diary_id and id=any(placement_ids);
  if name='reflection' then update journal.reflections set deleted_at=moment where diary_id=p_diary_id and id=target;end if;
  insert into journal.trash(diary_id,entity_type,entity_id,title,deleted_at,batch) values(p_diary_id,name,target,coalesce(old_value->>'title',old_value->>'local_date','실행 기록'),moment,
   jsonb_build_object('taskIds',to_jsonb(coalesce(task_ids,'{}')),'runIds',to_jsonb(case when name='run' then coalesce(run_ids,'{}'::uuid[]) else '{}'::uuid[] end),'placementIds',to_jsonb(coalesce(placement_ids,'{}'))));
 elsif p_command='restore_entity' then
  select * into item from journal.trash where diary_id=p_diary_id and id=(p_payload->>'trashId')::uuid and restored_at is null;
  if not found then raise exception 'Trash entry required' using errcode='22023';end if;target:=item.entity_id;
  if item.entity_type in ('task','run','placement') then
   select t.plan_id into parent from journal.tasks t where t.diary_id=p_diary_id and t.id=case when item.entity_type='task' then target
    when item.entity_type='run' then (select task_id from journal.runs where diary_id=p_diary_id and id=target) else (select task_id from journal.placements where diary_id=p_diary_id and id=target) end
    and (item.entity_type='task' or t.deleted_at is null);
   if parent is null or not exists(select 1 from journal.plans where diary_id=p_diary_id and id=parent and deleted_at is null) then raise exception 'Restore parent first' using errcode='22023';end if;
  end if;
  if item.entity_type='plan' then update journal.plans set deleted_at=null where diary_id=p_diary_id and id=target;end if;
  if exists(select 1 from journal.runs restored join journal.runs active on active.diary_id=restored.diary_id and active.id<>restored.id and active.deleted_at is null
    and active.started_at<restored.ended_at and coalesce(active.ended_at,'infinity'::timestamptz)>restored.started_at where restored.diary_id=p_diary_id and restored.id in
    (select value::uuid from jsonb_array_elements_text(item.batch->'runIds')) and restored.deleted_at=item.deleted_at) then raise exception 'Restored actual runs would overlap' using errcode='22023';end if;
  update journal.tasks set deleted_at=null where diary_id=p_diary_id and id in (select value::uuid from jsonb_array_elements_text(item.batch->'taskIds')) and deleted_at=item.deleted_at;
  update journal.runs set deleted_at=null where diary_id=p_diary_id and id in (select value::uuid from jsonb_array_elements_text(item.batch->'runIds')) and deleted_at=item.deleted_at;
  update journal.placements set deleted_at=null where diary_id=p_diary_id and id in (select value::uuid from jsonb_array_elements_text(item.batch->'placementIds')) and deleted_at=item.deleted_at;
  if item.entity_type='reflection' then update journal.reflections set deleted_at=null where diary_id=p_diary_id and id=target;end if;
  update journal.trash set restored_at=now() where diary_id=p_diary_id and id=item.id;
 end if;
 update journal.diaries set revision=revision+1 where id=p_diary_id returning revision into rev;
 result:=jsonb_build_object('revision',rev,'entityId',target);insert into journal.command_receipts(diary_id,request_id,request,result) values(p_diary_id,p_request_id,req,result);return result;
end;$$;

revoke all on function journal.core_command_v5(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;
create or replace function public.haru_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select journal.snapshot_v4('00000000-0000-4000-8000-000000000006'::uuid)||jsonb_build_object(
 'schemaVersion',5,
 'retainedTasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('tags',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name,g.id) from journal.task_tags link join journal.tags g on g.id=link.tag_id and g.diary_id=link.diary_id where link.diary_id=t.diary_id and link.task_id=t.id),'[]'::jsonb)) order by t.created_at,t.id)
 from journal.tasks t where t.diary_id='00000000-0000-4000-8000-000000000006'::uuid and t.deleted_at is not null
 and (exists(select 1 from journal.runs r where r.diary_id=t.diary_id and r.task_id=t.id and r.deleted_at is null) or exists(select 1 from journal.thoughts h where h.diary_id=t.diary_id and h.task_id=t.id))),'[]'::jsonb),
 'thoughts',coalesce((select jsonb_agg(to_jsonb(h) order by h.local_date,h.id) from journal.thoughts h where h.diary_id='00000000-0000-4000-8000-000000000006'::uuid),'[]'::jsonb));
$$;
create or replace function public.haru_command(p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740991 then raise exception 'Invalid envelope' using errcode='22023';end if;
 return journal.core_command_v5('00000000-0000-4000-8000-000000000006'::uuid,p_request_id,p_expected_revision,p_command,journal.validate_command(p_command,p_payload));
end;$$;
-- Export remains complete, including audit and recoverable deleted sources.
create or replace function public.haru_export() returns jsonb language sql stable security definer set search_path='' as $$
 select journal.export_v4('00000000-0000-4000-8000-000000000006'::uuid)||jsonb_build_object('schemaVersion',5);
$$;
notify pgrst,'reload schema';
commit;
