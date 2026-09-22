begin;
-- Only the local operations worker may call this. There is no public purge RPC.
create function journal.purge_due_account(u uuid,expected_diary uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare d uuid;r journal.account_deletions;name text;
begin
 perform 1 from auth.users where id=u for update;
 select * into r from journal.account_deletions where user_id=u for update;
 if not found or r.delete_after>clock_timestamp() then return false;end if;
 select diary_id into d from journal.account_diaries where user_id=u;
 if d is distinct from expected_diary then raise exception 'Diary ownership changed';end if;
 perform 1 from journal.diaries where id=d for update;
 foreach name in array array['segments','thoughts','task_tags','placements','runs','tasks','routine_rules','improvements','plans','tags','reflections','day_closures','trash','command_receipts','revisions'] loop
  execute format('delete from journal.%I where diary_id=$1',name) using d;
 end loop;
 delete from journal.account_diaries where user_id=u;
 delete from journal.diaries where id=d;
 delete from auth.sessions where user_id=u;
 delete from auth.users where id=u;
 return true;
end $$;
revoke all on function journal.purge_due_account(uuid,uuid) from public,anon,authenticated,service_role;
commit;
