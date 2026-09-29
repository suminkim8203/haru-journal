-- T07 plan lifecycle and stable calendar marker. Apply after private RPC cutover.
begin;

alter table journal.plans
 add column marker_color text check(marker_color in ('warm','gold','mint','blue','violet')),
 add column closed_at timestamptz;

with ordered as (
 select id,row_number() over(partition by diary_id order by created_at,id) as n
 from journal.plans
)
update journal.plans p set marker_color=(array['warm','gold','mint','blue','violet'])[1+((ordered.n-1)%5)::int]
from ordered where ordered.id=p.id;
alter table journal.plans alter column marker_color set not null;

create function journal.assign_plan_marker() returns trigger
language plpgsql security definer set search_path='' as $$
declare n bigint;
begin
 if new.marker_color is not null then return new;end if;
 select count(*) into n from journal.plans where diary_id=new.diary_id;
 new.marker_color:=(array['warm','gold','mint','blue','violet'])[1+(n%5)::int];
 return new;
end $$;
create trigger assign_plan_marker before insert on journal.plans
for each row execute function journal.assign_plan_marker();

-- Keep the existing authenticated ownership checks and core command intact.
alter function public.haru_command(uuid,bigint,text,jsonb) set schema journal;
alter function journal.haru_command(uuid,bigint,text,jsonb) rename to private_command_v7;

create function public.haru_command(p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d uuid:=journal.require_account_diary(); plan_row journal.plans%rowtype;
 task_plan uuid; receipt journal.command_receipts%rowtype; rev bigint; req jsonb; result jsonb;
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0
  or p_expected_revision>9007199254740991 or jsonb_typeof(p_payload) is distinct from 'object'
  or octet_length(p_payload::text)>32768 then
  raise exception 'Invalid envelope' using errcode='22023';
 end if;

 -- A retry of an earlier successful command must keep its original receipt,
 -- even if that plan was closed after the first response was lost.
 if p_command in ('create_task','create_placement','update_placement','start_run')
  and exists(select 1 from journal.command_receipts where diary_id=d and request_id=p_request_id) then
  return journal.private_command_v7(p_request_id,p_expected_revision,p_command,p_payload);
 end if;

 if p_command in ('create_task','create_placement','update_placement','start_run') then
  if p_command='create_task' then
   select id into task_plan from journal.plans where diary_id=d and id=(p_payload->>'planId')::uuid and deleted_at is null;
  else
   select plan_id into task_plan from journal.tasks where diary_id=d and id=(p_payload->>'taskId')::uuid and deleted_at is null;
  end if;
  if task_plan is not null and exists(select 1 from journal.plans where diary_id=d and id=task_plan and closed_at is not null) then
   raise exception 'Closed plan: reopen it before adding tasks or recording new work' using errcode='22023';
  end if;
 end if;
 if p_command not in ('set_plan_marker','close_plan','reopen_plan') then
  return journal.private_command_v7(p_request_id,p_expected_revision,p_command,p_payload);
 end if;

 if not p_payload?'planId' then raise exception 'Plan ID required' using errcode='22023';end if;
 if p_command='set_plan_marker' and coalesce(p_payload->>'markerColor','') not in ('warm','gold','mint','blue','violet') then
  raise exception 'Invalid marker color' using errcode='22023';
 end if;
 select * into plan_row from journal.plans where diary_id=d and id=(p_payload->>'planId')::uuid and deleted_at is null;
 if not found then raise exception 'Plan not found' using errcode='PT404';end if;
 if p_command in ('close_plan','reopen_plan') and plan_row.kind<>'general' then
  raise exception 'Only general plans can be ended' using errcode='22023';
 end if;

 select revision into rev from journal.diaries where id=d for update;
 req:=jsonb_build_object('command',p_command,'payload',p_payload,'expectedRevision',p_expected_revision);
 select * into receipt from journal.command_receipts where diary_id=d and request_id=p_request_id;
 if found then
  if receipt.request<>req then raise exception 'Request ID reused with different content' using errcode='P0002';end if;
  return receipt.result;
 end if;
 if rev<>p_expected_revision then raise exception 'Revision conflict' using errcode='P0001';end if;
 if p_command='close_plan' then
  if plan_row.closed_at is not null then raise exception 'Plan already ended' using errcode='22023';end if;
  if exists(select 1 from journal.runs r join journal.tasks t on (t.diary_id,t.id)=(r.diary_id,r.task_id)
   where t.diary_id=d and t.plan_id=plan_row.id and r.ended_at is null and r.deleted_at is null) then
   raise exception 'End the running record first' using errcode='22023';
  end if;
 elsif p_command='reopen_plan' and plan_row.closed_at is null then
  raise exception 'Plan is already open' using errcode='22023';
 end if;

 insert into journal.revisions(diary_id,entity_type,entity_id,previous_value)
 values(d,'plan',plan_row.id,to_jsonb(plan_row));
 if p_command='set_plan_marker' then
  update journal.plans set marker_color=p_payload->>'markerColor',updated_at=now() where diary_id=d and id=plan_row.id;
 elsif p_command='close_plan' then
  update journal.plans set closed_at=now(),updated_at=now() where diary_id=d and id=plan_row.id;
 else
  update journal.plans set closed_at=null,updated_at=now() where diary_id=d and id=plan_row.id;
 end if;
 update journal.diaries set revision=revision+1 where id=d returning revision into rev;
 result:=jsonb_build_object('revision',rev,'entityId',plan_row.id);
 insert into journal.command_receipts(diary_id,request_id,request,result)
 values(d,p_request_id,req,result);
 return result;
end $$;

revoke all on function journal.assign_plan_marker(),journal.private_command_v7(uuid,bigint,text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.haru_command(uuid,bigint,text,jsonb) from public,anon;
grant execute on function public.haru_command(uuid,bigint,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
