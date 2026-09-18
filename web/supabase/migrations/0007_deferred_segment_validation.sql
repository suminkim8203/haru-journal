-- Deferred triggers run after the public RPC returns to the caller role.
-- The validator needs owner access without granting clients schema/table access.
begin;
alter function journal.check_run_segments() security definer;
alter function journal.check_run_segments() set search_path='';
revoke all on function journal.check_run_segments() from public,anon,authenticated,service_role;
commit;
