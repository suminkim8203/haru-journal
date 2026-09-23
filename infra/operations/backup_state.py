"""Owner-only backup fingerprints; never calls public diary RPC or logs rows."""
import json,re
def journal_state(query):
 tables=json.loads(query("select coalesce(json_agg(tablename order by tablename),'[]') from pg_tables where schemaname='journal' and tablename<>'auth_attempt_windows';"))
 values={}
 for name in tables:
  if not re.fullmatch(r'[a-z_][a-z0-9_]*',name):raise RuntimeError('Invalid relation name')
  row=query("set timezone='UTC';select count(*)::text||':'||md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate \"C\")::text,'[]')) from journal."+name+' t;')
  count,digest=row.split(':',1);values[name]={'rows':int(count),'digest':digest}
 return {'backupStateVersion':3,'tables':values}
