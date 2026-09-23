-- Offline restored database only. Set haru.erase_user / haru.erase_diary to UUIDs.
-- Never run this against the live service. The caller verifies isolated container/network.
begin;
create temporary table haru_preserved(name text primary key,filter text,signature text) on commit drop;
do $$declare r record;u uuid:=current_setting('haru.erase_user')::uuid;d uuid:=current_setting('haru.erase_diary')::uuid;f text;s text;
begin
 for r in select table_name from information_schema.tables where table_schema='journal' and table_type='BASE TABLE' loop
  f:=null;
  if exists(select 1 from information_schema.columns where table_schema='journal' and table_name=r.table_name and column_name='diary_id') then f:=format('diary_id is distinct from %L::uuid',d);
  elsif r.table_name='diaries' then f:=format('id<>%L::uuid',d);
  elsif exists(select 1 from information_schema.columns where table_schema='journal' and table_name=r.table_name and column_name='user_id') then f:=format('user_id is distinct from %L::uuid',u);
  else f:='true';end if;
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) from journal.%I x where %s',r.table_name,f) into s;
  insert into haru_preserved values(r.table_name,f,s);
 end loop;
end $$;
-- Disable FK ordering only inside this isolated transaction, then validate retained rows.
set local session_replication_role=replica;
do $$declare r record;begin
 for r in select * from haru_preserved where filter<>'true' loop
  execute format('delete from journal.%I where not (%s)',r.name,r.filter);
 end loop;
end $$;
set local session_replication_role=origin;
do $$declare u uuid:=current_setting('haru.erase_user')::uuid;r record;s text;begin
 if to_regclass('auth.users') is not null then delete from auth.users where id=u;end if;
 for r in select * from haru_preserved loop
  execute format('select md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,''[]'')) from journal.%I x',r.name) into s;
  if s is distinct from r.signature then raise exception 'Other account data changed: rollback';end if;
 end loop;
end $$;
commit;
