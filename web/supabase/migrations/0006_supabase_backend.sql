-- T06: Supabase owns validation, transactions, history and API access.
-- Only the explicitly public single diary is reachable by the application's anon key.
begin;
alter function public.journal_snapshot(uuid) set schema journal;
alter function journal.journal_snapshot(uuid) rename to snapshot_v4;
alter function public.journal_command(uuid,uuid,bigint,text,jsonb) set schema journal;
alter function journal.journal_command(uuid,uuid,bigint,text,jsonb) rename to core_command_v4;
alter function public.journal_export(uuid) set schema journal;
alter function journal.journal_export(uuid) rename to export_v4;
revoke all on function journal.snapshot_v4(uuid),journal.core_command_v4(uuid,uuid,bigint,text,jsonb),journal.export_v4(uuid) from public,anon,authenticated,service_role;

create function journal.require_field(p jsonb,k text,t text,required boolean default true,cap integer default null) returns void
language plpgsql set search_path='' as $$
declare v jsonb:=p->k; s text:=p->>k;
begin
 if not (p?k) and not required then return;end if;
 if v is null or v='null'::jsonb then raise exception 'Missing field: %',k using errcode='22023';end if;
 if t in ('text','nonempty','uuid','date','instant','priority') then
  if jsonb_typeof(v)<>'string' then raise exception 'Invalid field type: %',k using errcode='22023';end if;
  if cap is not null and length(s)>cap then raise exception 'Field too long: %',k using errcode='22023';end if;
 end if;
 if t='nonempty' and length(btrim(s))=0 then raise exception 'Empty field: %',k using errcode='22023';
 elsif t='uuid' and s!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Invalid UUID: %',k using errcode='22023';
 elsif t='date' then
  if s!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or s<'0001-01-01' then raise exception 'Invalid date: %',k using errcode='22023';end if;
  if to_char(s::date,'YYYY-MM-DD')<>s then raise exception 'Invalid date: %',k using errcode='22023';end if;
 elsif t='instant' then
  if s!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$' then raise exception 'UTC timestamp required: %',k using errcode='22023';end if;
  if substring(s,12,2)::int>23 or substring(s,15,2)::int>59 or substring(s,18,2)::int>59 or substring(s,1,10)<'0001-01-01' then raise exception 'Invalid timestamp: %',k using errcode='22023';end if;
  perform s::timestamptz;
 elsif t='boolean' and jsonb_typeof(v)<>'boolean' then raise exception 'Boolean required: %',k using errcode='22023';
 elsif t='integer' then
  if jsonb_typeof(v)<>'number' then raise exception 'Integer required: %',k using errcode='22023';end if;
  if s::numeric<>trunc(s::numeric) or s::numeric<0 or (cap is not null and s::numeric>cap) then raise exception 'Integer out of range: %',k using errcode='22023';end if;
 elsif t='priority' and s not in ('high','normal','low') then raise exception 'Invalid priority' using errcode='22023';end if;
end;$$;

create function journal.validate_command(c text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare item jsonb; last_end timestamptz; a timestamptz;b timestamptz; normalized jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>32768 then raise exception 'Invalid or oversized payload' using errcode='22023';end if;
 if c in ('create_plan','update_plan') then
  perform journal.require_field(p,'title','nonempty',true,120);
  perform journal.require_field(p,'successText','text',false,4000);
  perform journal.require_field(p,'estimatedMinutes','integer',false,525600);
  perform journal.require_field(p,'priority','priority',false);
  perform journal.require_field(p,'startDate','date');perform journal.require_field(p,'endDate','date');
  if p->>'startDate'>p->>'endDate' then raise exception 'Invalid plan period' using errcode='22023';end if;
  if c='create_plan' then
   if p->>'kind' is distinct from 'general' then raise exception 'General plan required' using errcode='22023';end if;
   if p?'sourcePlanId' then perform journal.require_field(p,'sourcePlanId','uuid');perform journal.require_field(p,'improvementText','nonempty',true,500);end if;
  else perform journal.require_field(p,'planId','uuid');end if;
 elsif c in ('create_task','update_task') then
  perform journal.require_field(p,'title','nonempty',true,120);perform journal.require_field(p,'description','text',false,4000);
  perform journal.require_field(p,'estimatedMinutes','integer',false,10080);perform journal.require_field(p,'priority','priority',false);
  perform journal.require_field(p,case when c='create_task' then 'planId' else 'taskId' end,'uuid');
  if p?'dueDate' and p->'dueDate'<>'""'::jsonb then perform journal.require_field(p,'dueDate','date');end if;
  if p?'tags' then
   if jsonb_typeof(p->'tags')<>'array' then raise exception 'Invalid tags' using errcode='22023';end if;
   if jsonb_array_length(p->'tags')>20 then raise exception 'Too many tags' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(p->'tags') loop
    perform journal.require_field(jsonb_build_object('tag',item),'tag','nonempty',true,30);
   end loop;
   select coalesce(jsonb_agg(name order by ord),'[]'::jsonb) into normalized from
    (select btrim(value#>>'{}') name,min(ordinality) ord from jsonb_array_elements(p->'tags') with ordinality group by btrim(value#>>'{}')) tags;
   p:=jsonb_set(p,'{tags}',normalized);
  end if;
 elsif c='set_task_complete' then
  perform journal.require_field(p,'taskId','uuid');perform journal.require_field(p,'complete','boolean');perform journal.require_field(p,'at','instant',false);perform journal.require_field(p,'blockedReason','text',false,2000);
 elsif c in ('create_placement','update_placement','create_run','update_run') then
  perform journal.require_field(p,case when c='update_run' then 'runId' else 'taskId' end,'uuid');
  if c='update_placement' then perform journal.require_field(p,'placementId','uuid');end if;
  perform journal.require_field(p,'startedAt','instant');perform journal.require_field(p,'endedAt','instant');perform journal.require_field(p,'allowOverlap','boolean',false);perform journal.require_field(p,'blockedReason','text',false,2000);
  if (p->>'endedAt')::timestamptz<=(p->>'startedAt')::timestamptz then raise exception 'Invalid time range' using errcode='22023';end if;
  if c in ('create_run','update_run') then
   if jsonb_typeof(p->'segments') is distinct from 'array' then raise exception 'Segments required' using errcode='22023';end if;
   if jsonb_array_length(p->'segments') not between 1 and 101 then raise exception 'Invalid segments' using errcode='22023';end if;
   last_end:=(p->>'startedAt')::timestamptz;
   for item in select value from jsonb_array_elements(p->'segments') loop
    perform journal.require_field(item,'startedAt','instant');perform journal.require_field(item,'endedAt','instant');
    if item->>'kind' is null or item->>'kind' not in ('work','pause','break','interrupt') then raise exception 'Invalid segment kind' using errcode='22023';end if;
    a:=(item->>'startedAt')::timestamptz;b:=(item->>'endedAt')::timestamptz;
    if a<>last_end or b<=a or b>(p->>'endedAt')::timestamptz then raise exception 'Invalid segment range' using errcode='22023';end if;last_end:=b;
   end loop;
   if last_end<>(p->>'endedAt')::timestamptz then raise exception 'Incomplete segments' using errcode='22023';end if;
  end if;
 elsif c in ('start_run','switch_segment','stop_run') then
  perform journal.require_field(p,case when c='start_run' then 'taskId' else 'runId' end,'uuid');perform journal.require_field(p,'at','instant');perform journal.require_field(p,'blockedReason','text',false,2000);
  if c='switch_segment' and (p->>'kind' is null or p->>'kind' not in ('work','pause','break','interrupt')) then raise exception 'Invalid segment kind' using errcode='22023';end if;
 elsif c in ('save_thought','save_reflection','close_day') then
  perform journal.require_field(p,'date','date');perform journal.require_field(p,'body',case when c='close_day' then 'text' else 'nonempty' end,c<>'close_day',4000);
  if c='save_thought' then perform journal.require_field(p,'taskId','uuid');end if;
  if p?'imports' then
   if jsonb_typeof(p->'imports')<>'array' then raise exception 'Invalid imports' using errcode='22023';end if;
   if jsonb_array_length(p->'imports')>500 then raise exception 'Too many imports' using errcode='22023';end if;
   for item in select value from jsonb_array_elements(p->'imports') loop perform journal.require_field(item,'id','uuid');perform journal.require_field(item,'body','text',true,4000);end loop;
  end if;
 elsif c='bookmark_reflection' then
  perform journal.require_field(p,'reflectionId','uuid');perform journal.require_field(p,'bookmarked','boolean');
 elsif c='send_improvement' then
  perform journal.require_field(p,'sourcePlanId','uuid');perform journal.require_field(p,'targetPlanId','uuid');perform journal.require_field(p,'body','nonempty',true,500);
  if p->>'sourcePlanId'=p->>'targetPlanId' then raise exception 'Distinct plans required' using errcode='22023';end if;
 elsif c='delete_entity' then
  perform journal.require_field(p,'entityId','uuid');perform journal.require_field(p,'at','instant',false);
  if p->>'entityType' is null or p->>'entityType' not in ('plan','task','run','placement','reflection') then raise exception 'Invalid entity type' using errcode='22023';end if;
 elsif c='restore_entity' then perform journal.require_field(p,'trashId','uuid');
 else raise exception 'Unsupported command' using errcode='22023';end if;
 return p;
end;$$;

create function public.haru_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select journal.snapshot_v4('00000000-0000-4000-8000-000000000006'::uuid);
$$;
create function public.haru_command(p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740991 then raise exception 'Invalid envelope' using errcode='22023';end if;
 return journal.core_command_v4('00000000-0000-4000-8000-000000000006'::uuid,p_request_id,p_expected_revision,p_command,journal.validate_command(p_command,p_payload));
end;$$;
create function public.haru_export() returns jsonb language sql stable security definer set search_path='' as $$
 select journal.export_v4('00000000-0000-4000-8000-000000000006'::uuid);
$$;
revoke all on function journal.require_field(jsonb,text,text,boolean,integer),journal.validate_command(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.haru_snapshot(),public.haru_command(uuid,bigint,text,jsonb),public.haru_export() from public;
grant execute on function public.haru_snapshot(),public.haru_command(uuid,bigint,text,jsonb),public.haru_export() to anon,authenticated;
-- Keep table access denied; no blanket INSERT/UPDATE/DELETE policies or RLS bypass.
revoke all on schema journal from public,anon,authenticated;
revoke all on all tables in schema journal from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
