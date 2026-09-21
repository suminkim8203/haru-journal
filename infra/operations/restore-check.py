import subprocess,json,pathlib,os,time,datetime,re,hashlib,sys
os.umask(0o077)
if len(sys.argv)!=2: raise SystemExit('Usage: sudo python3 restore-check.py /backup/haru-operations/BACKUP_DIRECTORY')
root=pathlib.Path(sys.argv[1]).resolve()
assert any(root.is_relative_to(pathlib.Path(parent)) for parent in ['/backup/haru-operations','/opt/supabase/backups/haru-operations']) and (root/'backup-report.json').is_file()
report={'backup':str(root),'productionModified':False}
name='haru-restore-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
def run(a,data=None,check=True):
 r=subprocess.run(a,input=data,capture_output=True)
 if r.returncode and check:
  (root/'restore-failure.log').write_bytes(r.stderr);raise RuntimeError('Restore command failed: '+a[0])
 return r
bootstrap=run(['docker','exec','supabase-db','psql','-U','postgres','-d','postgres','-XqAt','-c','select rolname from pg_roles where oid=10;']).stdout.decode().strip()
assert re.fullmatch(r'[a-z_][a-z0-9_]*',bootstrap)
image=run(['docker','inspect','supabase-db','--format','{{.Image}}']).stdout.decode().strip()
run(['docker','run','-d','--name',name,'--network','none','--memory','512m','--cpus','0.5','--pids-limit','128','--user','postgres','--entrypoint','/bin/sh',image,'-c',f"(test -f /tmp/restore-db/PG_VERSION || initdb -D /tmp/restore-db -U {bootstrap} --auth=trust >/tmp/init.log 2>&1) && exec postgres -D /tmp/restore-db -c listen_addresses='' -c unix_socket_directories=/tmp -c shared_preload_libraries=pg_stat_statements,pg_net"])
def sql(q,check=True):
 return run(['docker','exec','-i',name,'psql','-h','/tmp','-U',bootstrap,'-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],q.encode(),check)
try:
 for i in range(40):
  if sql('select 1;',False).returncode==0:break
  time.sleep(1)
 else:
  (root/'restore-container.log').write_bytes(run(['docker','logs',name],check=False).stderr)
  raise RuntimeError('Isolated database did not start')
 roles=(root/'roles.sql').read_text()
 roles=re.sub(r'^CREATE ROLE '+re.escape(bootstrap)+r';\n','',roles,flags=re.M)
 report['bootstrapRoleMatched']=True

 sql(roles)
 full=run(['docker','exec','-i',name,'pg_restore','-h','/tmp','-U',bootstrap,'-d','postgres'],(root/'postgres.dump').read_bytes(),False)
 (root/'full-restore.log').write_bytes(full.stderr)
 report['fullDatabaseRestoreExitCode']=full.returncode
 assert full.returncode==0,'Full database restore failed; inspect private restore log'
 report['additionalDatabases']=[]
 for database in json.loads((root/'databases.json').read_text()):
  if database=='postgres':continue
  assert re.fullmatch(r'[a-z_][a-z0-9_]*',database)
  sql('create database "'+database+'";')
  archive=root/('database-'+hashlib.sha256(database.encode()).hexdigest()[:12]+'.dump')
  extra=run(['docker','exec','-i',name,'pg_restore','-h','/tmp','-U',bootstrap,'-d',database],archive.read_bytes(),False)
  (root/(database+'-restore.log')).write_bytes(extra.stderr)
  report['additionalDatabases'].append({'database':database,'restoreExitCode':extra.returncode})
  assert extra.returncode==0,'Additional database restore failed'
 snap=sql('set role anon;select public.haru_snapshot();')
 restored=json.loads(snap.stdout.decode())
 expected=json.loads((root/'snapshot-before.json').read_text())
 diffs=[]
 def diff(a,b,path=''):
  if type(a)!=type(b):diffs.append(path+':type');return
  if isinstance(a,dict):
   for k in set(a)|set(b):
    if k not in a or k not in b:diffs.append(path+'/'+k+':missing')
    else:diff(a[k],b[k],path+'/'+k)
  elif isinstance(a,list):
   if len(a)!=len(b):diffs.append(path+':length')
   for i,(x,y) in enumerate(zip(a,b)):diff(x,y,path+'/'+str(i))
  elif a!=b:diffs.append(path)
 diff(expected,restored)
 report['differentPaths']=diffs
 report['snapshotExactMatch']=restored==expected
 for snap in [restored,expected]:
  for task in snap['tasks']:task['tags'].sort(key=lambda t:t['id'])
 report['snapshotEqualIgnoringTagOrder']=restored==expected
 assert restored==expected,'Unexpected snapshot differences'
 (root/'restored-snapshot.json').write_text(json.dumps(restored))
 report['revision']=restored['revision']
 report['counts']={k:len(restored.get(k,[])) for k in ['plans','tasks','placements','runs','thoughts','reflections','improvements']}
 report['permissionBoundary']=sql("select has_function_privilege('anon','public.haru_command(uuid,bigint,text,jsonb)','EXECUTE') and not has_schema_privilege('anon','journal','USAGE');").stdout.decode().strip()=='t'
 report['tableChecks']=[]
 def source_sql(q):
  return run(['docker','exec','-i','supabase-db','psql','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],q.encode()).stdout.decode().strip()
 for table in json.loads(source_sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='journal';")):
  assert re.fullmatch(r'[a-z_][a-z0-9_]*',table)
  query="select count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from journal."+table+" t;"
  a=source_sql(query);b=sql(query).stdout.decode().strip()
  assert a==b,'Table differs '+table
  report['tableChecks'].append({'table':table,'rows':int(a.split('|')[0]),'match':True})
 report['allJournalTablesExact']=True
 report['journalTables']=int(sql("select count(*) from information_schema.tables where table_schema='journal';").stdout)
 report['network']='none'
 report['publicPorts']=False
 report['container']=name
 report['errorSummary']='\n'.join(line for line in full.stderr.decode().splitlines() if 'ERROR:' in line or 'errors ignored' in line)
finally:
 run(['docker','stop',name],check=False)
 report['containerStopped']=run(['docker','inspect',name,'--format','{{.State.Running}}']).stdout.decode().strip()=='false'
 (root/'restore-report.json').write_text(json.dumps(report,indent=2))
 pathlib.Path('/tmp/haru-restore-result.json').write_text(json.dumps(report,indent=2))
 print(json.dumps({k:v for k,v in report.items() if k!='errorSummary'}))



p=pathlib.Path('/tmp/haru-restore-complete.json');p.write_text(json.dumps(report,indent=2))
