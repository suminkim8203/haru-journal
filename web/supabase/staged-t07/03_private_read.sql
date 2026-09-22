-- Staged only; apply after 01/02 with the private application cutover.
begin;
create function public.haru_resource(p_kind text,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d uuid:=journal.require_account_diary(); collection text; result jsonb;
begin
 collection:=case p_kind when 'plan' then 'plans' when 'task' then 'tasks' when 'run' then 'runs' when 'placement' then 'placements' when 'reflection' then 'reflections' when 'thought' then 'thoughts' end;
 if collection is null then raise exception 'Invalid resource type' using errcode='22023';end if;
 perform journal.require_owned_resource(d,p_kind,p_id);
 -- Reuse the public snapshot shape instead of exposing raw database columns.
 select value into result from jsonb_array_elements(public.haru_snapshot()->collection) where value->>'id'=p_id::text;
 if result is null then raise exception 'Resource not found' using errcode='PT404';end if;
 return result;
end $$;
revoke all on function public.haru_resource(text,uuid) from public,anon;
grant execute on function public.haru_resource(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
