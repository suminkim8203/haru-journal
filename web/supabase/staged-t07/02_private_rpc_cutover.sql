-- Staged only. Requires verified owner mapping, working auth/mail and full evidence before deployment.
begin;
-- Rebind only existing entry-point layers; parameterized core functions stay unchanged.
do $$
declare r record; definition text; updated integer:=0;
begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('haru_snapshot','haru_command','haru_export'))
 or (n.nspname='journal' and p.proname in ('snapshot_v5','snapshot_v6','command_v6')) loop
  definition:=pg_get_functiondef(r.oid);
  if position('''00000000-0000-4000-8000-000000000006''' in definition)>0 then
   definition:=replace(definition,'''00000000-0000-4000-8000-000000000006''','journal.require_account_diary()');
   execute definition;updated:=updated+1;
  end if;
 end loop;
 if updated<>6 then raise exception 'Unexpected source schema: private cutover aborted';end if;
end $$;
-- Every supplied resource reference is checked before mutation, including imported thoughts.
create function journal.require_owned_resource(d uuid,kind text,resource_id uuid) returns void
language plpgsql stable security definer set search_path='' as $$
declare tbl text; found_resource boolean;
begin
 tbl:=case kind when 'plan' then 'plans' when 'task' then 'tasks' when 'run' then 'runs' when 'placement' then 'placements' when 'reflection' then 'reflections' when 'routine' then 'routine_rules' when 'improvement' then 'improvements' when 'thought' then 'thoughts' when 'trash' then 'trash' end;
 if tbl is null then raise exception 'Invalid resource type' using errcode='22023';end if;
 execute format('select exists(select 1 from journal.%I where diary_id=$1 and id=$2)',tbl) into found_resource using d,resource_id;
 if not found_resource then raise exception 'Resource not found' using errcode='PT404';end if;
end $$;
alter function public.haru_command(uuid,bigint,text,jsonb) set schema journal;
alter function journal.haru_command(uuid,bigint,text,jsonb) rename to private_command_impl;
create function public.haru_command(p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d uuid:=journal.require_account_diary(); ref record; item jsonb;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid payload' using errcode='22023';end if;
 for ref in select * from (values ('planId','plan'),('sourcePlanId','plan'),('targetPlanId','plan'),('taskId','task'),('runId','run'),('placementId','placement'),('reflectionId','reflection'),('routineId','routine'),('improvementId','improvement'),('trashId','trash')) v(key,kind) loop
  if p_payload?ref.key then perform journal.require_owned_resource(d,ref.kind,(p_payload->>ref.key)::uuid);end if;
 end loop;
 if p_payload?'entityId' then perform journal.require_owned_resource(d,p_payload->>'entityType',(p_payload->>'entityId')::uuid);end if;
 if p_payload?'imports' then
  for item in select value from jsonb_array_elements(p_payload->'imports') loop perform journal.require_owned_resource(d,'thought',(item->>'id')::uuid);end loop;
 end if;
 return journal.private_command_impl(p_request_id,p_expected_revision,p_command,p_payload);
end $$;
revoke all on function journal.private_command_impl(uuid,bigint,text,jsonb),journal.require_owned_resource(uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.haru_snapshot(),public.haru_command(uuid,bigint,text,jsonb),public.haru_export() from public,anon;
grant execute on function public.haru_snapshot(),public.haru_command(uuid,bigint,text,jsonb),public.haru_export() to authenticated;
notify pgrst,'reload schema';
commit;
