begin;
-- Keep the original copied sentence as the immutable duplicate key.
alter table journal.improvements add column body text;
alter table journal.improvements add column updated_at timestamptz not null default now();
update journal.improvements set body=source_text;
alter table journal.improvements alter column body set not null;
alter table journal.improvements add constraint improvement_body_length check(length(btrim(body)) between 1 and 500);
create function journal.improvement_copy_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.body:=coalesce(new.body,new.source_text);
 elsif new.source_text is distinct from old.source_text or new.source_plan_id is distinct from old.source_plan_id or new.target_plan_id is distinct from old.target_plan_id or new.diary_id is distinct from old.diary_id then
  raise exception 'Copied source and relationship are immutable' using errcode='22023';
 end if;
 return new;
end $$;
create trigger improvement_copy_guard before insert or update on journal.improvements for each row execute function journal.improvement_copy_guard();
alter function public.haru_snapshot() rename to snapshot_v6;
alter function public.snapshot_v6() set schema journal;
alter function public.haru_command(uuid,bigint,text,jsonb) rename to command_v6;
alter function public.command_v6(uuid,bigint,text,jsonb) set schema journal;
revoke all on function journal.snapshot_v6(),journal.command_v6(uuid,bigint,text,jsonb),journal.improvement_copy_guard() from public,anon,authenticated,service_role;
create function public.haru_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select journal.snapshot_v6()||jsonb_build_object('improvementEditing',true,'improvements',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('history',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from journal.revisions r where r.diary_id=i.diary_id and r.entity_type='improvement' and r.entity_id=i.id),'[]'::jsonb)) order by i.created_at,i.id) from journal.improvements i where i.diary_id='00000000-0000-4000-8000-000000000006'::uuid),'[]'::jsonb));
$$;
create function public.haru_command(p_request_id uuid,p_expected_revision bigint,p_command text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d constant uuid:='00000000-0000-4000-8000-000000000006';p jsonb:=p_payload;req jsonb;receipt journal.command_receipts%rowtype;rev bigint;result jsonb;item journal.improvements%rowtype;
begin
 if p_command is distinct from 'update_improvement' then return journal.command_v6(p_request_id,p_expected_revision,p_command,p_payload);end if;
 if p_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9007199254740991 or jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>32768 then raise exception 'Invalid envelope' using errcode='22023';end if;
 perform journal.require_field(p,'improvementId','uuid');perform journal.require_field(p,'body','nonempty',true,500);
 p:=jsonb_set(p,'{body}',to_jsonb(btrim(p->>'body')));
 select revision into rev from journal.diaries where id=d for update;
 req:=jsonb_build_object('command',p_command,'payload',p,'expectedRevision',p_expected_revision);
 select * into receipt from journal.command_receipts where diary_id=d and request_id=p_request_id;
 if found then if receipt.request<>req then raise exception 'Request ID reused with different content' using errcode='P0002';end if;return receipt.result;end if;
 if rev<>p_expected_revision then raise exception 'Revision conflict' using errcode='P0001';end if;
 select * into item from journal.improvements where diary_id=d and id=(p->>'improvementId')::uuid;
 if not found or not exists(select 1 from journal.plans where diary_id=d and id=item.target_plan_id and deleted_at is null and kind='general') then raise exception 'Improvement and active target plan required' using errcode='22023';end if;
 if item.body is distinct from p->>'body' then
  insert into journal.revisions(diary_id,entity_type,entity_id,previous_value) values(d,'improvement',item.id,to_jsonb(item));
  update journal.improvements set body=p->>'body',updated_at=now() where diary_id=d and id=item.id;
 end if;
 update journal.diaries set revision=revision+1 where id=d returning revision into rev;
 result:=jsonb_build_object('revision',rev,'entityId',item.id);
 insert into journal.command_receipts(diary_id,request_id,request,result) values(d,p_request_id,req,result);return result;
end $$;
revoke all on function public.haru_snapshot(),public.haru_command(uuid,bigint,text,jsonb) from public;
grant execute on function public.haru_snapshot(),public.haru_command(uuid,bigint,text,jsonb) to anon,authenticated;
notify pgrst,'reload schema';
commit;
