-- Preserve applied migrations. All mutations serialize on the diary row.
begin;
create table journal.placements (
 id uuid primary key default gen_random_uuid(), diary_id uuid not null references journal.diaries(id), task_id uuid not null,
 started_at timestamptz not null, ended_at timestamptz not null, deleted_at timestamptz,
 check(ended_at>started_at), unique(diary_id,id),
 foreign key(diary_id,task_id) references journal.tasks(diary_id,id)
);
create table journal.runs (
 id uuid primary key default gen_random_uuid(), diary_id uuid not null references journal.diaries(id), task_id uuid not null,
 started_at timestamptz not null, ended_at timestamptz, source text not null check(source in ('live','manual')),
 blocked_reason text not null default '' check(length(blocked_reason)<=2000), task_title text not null, plan_title text not null, deleted_at timestamptz,
 check(ended_at is null or ended_at>started_at), unique(diary_id,id),
 foreign key(diary_id,task_id) references journal.tasks(diary_id,id)
);
create unique index diary_one_open_run on journal.runs(diary_id) where ended_at is null and deleted_at is null;
create table journal.segments (
 id uuid primary key default gen_random_uuid(), diary_id uuid not null references journal.diaries(id), run_id uuid not null,
 kind text not null check(kind in ('work','pause','break','interrupt')), started_at timestamptz not null, ended_at timestamptz,
 check(ended_at is null or ended_at>=started_at), foreign key(diary_id,run_id) references journal.runs(diary_id,id)
);
create unique index run_one_open_segment on journal.segments(diary_id,run_id) where ended_at is null;
alter table journal.placements enable row level security;
alter table journal.runs enable row level security;
alter table journal.segments enable row level security;
revoke all on journal.placements,journal.runs,journal.segments from public,anon,authenticated;

-- Deferred constraints check the final state of each transaction, including direct SQL writes.
create function journal.check_run_segments() returns trigger language plpgsql set search_path='' as $$
declare r journal.runs%rowtype; s record; previous_end timestamptz; n integer:=0; open_count integer:=0;
begin
 if tg_table_name='runs' then
  select * into r from journal.runs where diary_id=coalesce(new.diary_id,old.diary_id) and id=coalesce(new.id,old.id);
 else
  select * into r from journal.runs where diary_id=coalesce(new.diary_id,old.diary_id) and id=coalesce(new.run_id,old.run_id);
 end if;
 if not found then return null; end if;
 previous_end:=r.started_at;
 for s in select * from journal.segments where diary_id=r.diary_id and run_id=r.id order by started_at, ended_at nulls last,id loop
   if previous_end is null or s.started_at<>previous_end or (r.ended_at is not null and (s.ended_at is null or s.ended_at>r.ended_at)) then
     raise exception 'Invalid segment range or overlap' using errcode='22023'; end if;
   n:=n+1; if s.ended_at is null then open_count:=open_count+1; end if; previous_end:=s.ended_at;
 end loop;
 if n=0 or (r.ended_at is null and open_count<>1) or (r.ended_at is not null and (open_count<>0 or previous_end<>r.ended_at)) then
   raise exception 'Segments must cover the whole run' using errcode='22023'; end if;
 return null;
end; $$;
create constraint trigger run_segments_complete after insert or update on journal.runs
 deferrable initially deferred for each row execute function journal.check_run_segments();
create constraint trigger segment_ranges_complete after insert or update or delete on journal.segments
 deferrable initially deferred for each row execute function journal.check_run_segments();
alter function public.journal_snapshot(uuid) rename to snapshot_v2;
alter function public.snapshot_v2(uuid) set schema journal;
alter function public.journal_command(uuid,uuid,bigint,text,jsonb) rename to core_command_v2;
alter function public.core_command_v2(uuid,uuid,bigint,text,jsonb) set schema journal;
revoke all on function journal.snapshot_v2(uuid),journal.core_command_v2(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;

create function public.journal_snapshot(p_diary_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select journal.snapshot_v2(p_diary_id)||jsonb_build_object('schemaVersion',3,
 'placements',coalesce((select jsonb_agg(to_jsonb(p) order by p.started_at,p.id) from journal.placements p
  where p.diary_id=p_diary_id and p.deleted_at is null),'[]'::jsonb),
 'runs',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('segments',coalesce((select jsonb_agg(to_jsonb(s) order by s.started_at,s.ended_at nulls last,s.id)
  from journal.segments s where s.diary_id=r.diary_id and s.run_id=r.id),'[]'::jsonb),
  'work_seconds',case when r.ended_at is null then null else coalesce((select sum(extract(epoch from s.ended_at-s.started_at)) from journal.segments s
   where s.diary_id=r.diary_id and s.run_id=r.id and s.kind='work'),0) end)
  order by r.started_at,r.id) from journal.runs r where r.diary_id=p_diary_id and r.deleted_at is null),'[]'::jsonb));
$$;
create function public.journal_command(p_diary_id uuid,p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rev bigint; req jsonb; result jsonb; receipt journal.command_receipts%rowtype;
 t journal.tasks%rowtype; r journal.runs%rowtype; placement journal.placements%rowtype;
 target uuid; moment timestamptz; begin_time timestamptz; end_time timestamptz; part jsonb;
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_payload) is distinct from 'object' then
  raise exception 'Invalid command envelope' using errcode='22023'; end if;
 select revision into rev from journal.diaries where id=p_diary_id for update;
 if not found then raise exception 'Diary missing' using errcode='22023'; end if;
 req:=jsonb_build_object('command',p_command,'payload',p_payload,'expectedRevision',p_expected_revision);
 select * into receipt from journal.command_receipts where diary_id=p_diary_id and request_id=p_request_id;
 if found then
  if receipt.request<>req then raise exception 'Request ID reused with different content' using errcode='P0002'; end if;
  return receipt.result;
 end if;
 if rev<>p_expected_revision then raise exception 'Revision conflict' using errcode='P0001'; end if;
 if p_command='set_task_complete' and p_payload->>'complete'='true' then
  select * into r from journal.runs where diary_id=p_diary_id and task_id=(p_payload->>'taskId')::uuid and ended_at is null and deleted_at is null;
  if found then
   moment:=coalesce((p_payload->>'at')::timestamptz,now());
   if moment<=r.started_at or moment<(select max(started_at) from journal.segments where diary_id=p_diary_id and run_id=r.id) then
    raise exception 'End must follow start' using errcode='22023'; end if;
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value)
    values(p_diary_id,'run',r.id,to_jsonb(r)||jsonb_build_object('segments',(select jsonb_agg(to_jsonb(s)) from journal.segments s where s.diary_id=p_diary_id and s.run_id=r.id)));
   update journal.segments set ended_at=moment where diary_id=p_diary_id and run_id=r.id and ended_at is null;
   update journal.runs set ended_at=moment,blocked_reason=coalesce(p_payload->>'blockedReason',blocked_reason) where diary_id=p_diary_id and id=r.id;
  end if;
 end if;
 if p_command in ('create_plan','update_plan','create_task','update_task','set_task_complete') then
  return journal.core_command_v2(p_diary_id,p_request_id,p_expected_revision,p_command,p_payload);
 end if;
 if p_command in ('create_placement','update_placement','start_run','create_run') then
  select * into t from journal.tasks where diary_id=p_diary_id and id=(p_payload->>'taskId')::uuid and deleted_at is null;
 elsif p_command in ('switch_segment','stop_run','update_run') then
  select * into r from journal.runs where diary_id=p_diary_id and id=(p_payload->>'runId')::uuid and deleted_at is null;
  if not found then raise exception 'Active run required' using errcode='22023'; end if;
  select * into t from journal.tasks where diary_id=p_diary_id and id=r.task_id and deleted_at is null;
 else raise exception 'Unsupported command' using errcode='22023'; end if;
 if t.id is null or not exists(select 1 from journal.plans where diary_id=p_diary_id and id=t.plan_id and deleted_at is null) then
  raise exception 'Active task and plan required' using errcode='22023'; end if;
 if t.complete and p_command in ('create_placement','update_placement','start_run') then
  raise exception 'Completed task cannot be scheduled or started' using errcode='22023'; end if;
 if p_command in ('create_placement','update_placement','create_run','update_run') then
  begin_time:=(p_payload->>'startedAt')::timestamptz; end_time:=(p_payload->>'endedAt')::timestamptz;
  if begin_time is null or end_time is null or end_time<=begin_time then raise exception 'Invalid time range' using errcode='22023'; end if;
 end if;
 if p_command in ('create_placement','update_placement') then
  if coalesce(p_payload->>'allowOverlap','false')<>'true' and exists(select 1 from journal.placements p where p.diary_id=p_diary_id and p.deleted_at is null
   and p.id<>coalesce((p_payload->>'placementId')::uuid,'00000000-0000-4000-8000-000000000000'::uuid) and p.started_at<end_time and p.ended_at>begin_time) then
   raise exception 'Placement overlap requires confirmation' using errcode='22023';end if;
  if p_command='update_placement' then
   select * into placement from journal.placements where diary_id=p_diary_id and id=(p_payload->>'placementId')::uuid and deleted_at is null;
   if not found or placement.task_id<>t.id then raise exception 'Active placement required' using errcode='22023'; end if;
   target:=placement.id;
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(p_diary_id,'placement',target,to_jsonb(placement));
   update journal.placements set started_at=begin_time,ended_at=end_time where diary_id=p_diary_id and id=target;
  else
   insert into journal.placements(diary_id,task_id,started_at,ended_at) values(p_diary_id,t.id,begin_time,end_time) returning id into target;
  end if;
 elsif p_command='start_run' then
  moment:=(p_payload->>'at')::timestamptz;
  if moment is null then raise exception 'Start required' using errcode='22023'; end if;
  if exists(select 1 from journal.runs other where other.diary_id=p_diary_id and other.deleted_at is null and (other.ended_at is null or other.ended_at>moment)) then
   raise exception 'Actual runs cannot overlap' using errcode='22023';end if;
  insert into journal.runs(diary_id,task_id,started_at,source,task_title,plan_title)
   select p_diary_id,t.id,moment,'live',t.title,p.title from journal.plans p where p.diary_id=p_diary_id and p.id=t.plan_id returning id into target;
  insert into journal.segments(diary_id,run_id,kind,started_at) values(p_diary_id,target,'work',moment);
 elsif p_command in ('switch_segment','stop_run') then
  if r.ended_at is not null then raise exception 'Open run required' using errcode='22023'; end if;
  moment:=(p_payload->>'at')::timestamptz;
  if moment is null or moment<=r.started_at or moment<(select max(started_at) from journal.segments where diary_id=p_diary_id and run_id=r.id) then
   raise exception 'Invalid segment end' using errcode='22023'; end if;
  if exists(select 1 from journal.runs other where other.diary_id=p_diary_id and other.deleted_at is null and other.id<>r.id and other.started_at<moment and coalesce(other.ended_at,'infinity'::timestamptz)>r.started_at) then raise exception 'Actual runs cannot overlap' using errcode='22023';end if;
  target:=r.id;
  insert into journal.revisions(diary_id,entity_type,entity_id,previous_value)
   values(p_diary_id,'run',r.id,to_jsonb(r)||jsonb_build_object('segments',(select jsonb_agg(to_jsonb(s)) from journal.segments s where s.diary_id=p_diary_id and s.run_id=r.id)));
  if p_command='switch_segment' then
   if (p_payload->>'kind') is null or (p_payload->>'kind') not in ('work','pause','break','interrupt') then raise exception 'Invalid segment kind' using errcode='22023'; end if;
   update journal.segments set ended_at=moment where diary_id=p_diary_id and run_id=r.id and ended_at is null;
   insert into journal.segments(diary_id,run_id,kind,started_at) values(p_diary_id,r.id,p_payload->>'kind',moment);
  else
   update journal.segments set ended_at=moment where diary_id=p_diary_id and run_id=r.id and ended_at is null;
   update journal.runs set ended_at=moment,blocked_reason=coalesce(p_payload->>'blockedReason',blocked_reason) where diary_id=p_diary_id and id=r.id;
  end if;
 elsif p_command in ('create_run','update_run') then
  if exists(select 1 from journal.runs other where other.diary_id=p_diary_id and other.deleted_at is null and other.id<>coalesce(r.id,'00000000-0000-4000-8000-000000000000'::uuid)
   and other.started_at<end_time and coalesce(other.ended_at,'infinity'::timestamptz)>begin_time) then raise exception 'Actual runs cannot overlap' using errcode='22023';end if;
  if jsonb_typeof(p_payload->'segments') is distinct from 'array' or jsonb_array_length(p_payload->'segments')=0 or jsonb_array_length(p_payload->'segments')>101 then
   raise exception 'Run segments required' using errcode='22023'; end if;
  if p_command='update_run' then
   if r.ended_at is null then raise exception 'Closed run required' using errcode='22023'; end if;
   target:=r.id;
   insert into journal.revisions(diary_id,entity_type,entity_id,previous_value)
    values(p_diary_id,'run',r.id,to_jsonb(r)||jsonb_build_object('segments',(select jsonb_agg(to_jsonb(s)) from journal.segments s where s.diary_id=p_diary_id and s.run_id=r.id)));
   delete from journal.segments where diary_id=p_diary_id and run_id=target;
   update journal.runs set started_at=begin_time,ended_at=end_time,blocked_reason=coalesce(p_payload->>'blockedReason',blocked_reason) where diary_id=p_diary_id and id=target;
  else
   insert into journal.runs(diary_id,task_id,started_at,ended_at,source,blocked_reason,task_title,plan_title)
    select p_diary_id,t.id,begin_time,end_time,'manual',coalesce(p_payload->>'blockedReason',''),t.title,p.title from journal.plans p
    where p.diary_id=p_diary_id and p.id=t.plan_id returning id into target;
  end if;
  for part in select value from jsonb_array_elements(p_payload->'segments') loop
   insert into journal.segments(diary_id,run_id,kind,started_at,ended_at)
    values(p_diary_id,target,part->>'kind',(part->>'startedAt')::timestamptz,(part->>'endedAt')::timestamptz);
  end loop;
 end if;
 update journal.diaries set revision=revision+1 where id=p_diary_id returning revision into rev;
 result:=jsonb_build_object('revision',rev,'entityId',target);
 insert into journal.command_receipts(diary_id,request_id,request,result) values(p_diary_id,p_request_id,req,result);
 return result;
end; $$;
revoke all on function public.journal_snapshot(uuid),public.journal_command(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.journal_snapshot(uuid),public.journal_command(uuid,uuid,bigint,text,jsonb) to service_role;
commit;
