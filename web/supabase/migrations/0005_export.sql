begin;
create function public.journal_export(p_diary_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion',4,'exportedAt',now(),'timezone',d.timezone,'diaryId',d.id,'revision',d.revision,
 'plans',coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from journal.plans p where p.diary_id=d.id),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.tasks t where t.diary_id=d.id),'[]'::jsonb),
 'tags',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.tags t where t.diary_id=d.id),'[]'::jsonb),
 'taskTags',coalesce((select jsonb_agg(to_jsonb(t) order by t.task_id,t.tag_id) from journal.task_tags t where t.diary_id=d.id),'[]'::jsonb),
 'placements',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.placements t where t.diary_id=d.id),'[]'::jsonb),
 'runs',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.runs t where t.diary_id=d.id),'[]'::jsonb),
 'segments',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.segments t where t.diary_id=d.id),'[]'::jsonb),
 'thoughts',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.thoughts t where t.diary_id=d.id),'[]'::jsonb),
 'reflections',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.reflections t where t.diary_id=d.id),'[]'::jsonb),
 'closures',coalesce((select jsonb_agg(to_jsonb(t) order by t.local_date) from journal.day_closures t where t.diary_id=d.id),'[]'::jsonb),
 'improvements',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.improvements t where t.diary_id=d.id),'[]'::jsonb),
 'trash',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.trash t where t.diary_id=d.id),'[]'::jsonb),
 'revisions',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from journal.revisions t where t.diary_id=d.id),'[]'::jsonb))
 from journal.diaries d where d.id=p_diary_id;
$$;
revoke all on function public.journal_export(uuid) from public,anon,authenticated;
grant execute on function public.journal_export(uuid) to service_role;
commit;
