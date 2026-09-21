import subprocess,json,pathlib,os,datetime,hashlib,tarfile,shutil
os.umask(0o077)
base=pathlib.Path('/opt/supabase/backups/haru-operations')
base.mkdir(parents=True,exist_ok=True,mode=0o700)
if shutil.disk_usage(base).free < 5*2**30: raise RuntimeError('Less than 5 GiB free; backup skipped without deleting existing backups')
root=base/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
root.mkdir(mode=0o700)
def run(args,input=None):
 r=subprocess.run(args,input=input,capture_output=True)
 if r.returncode:
  (root/'failure.log').write_bytes(r.stderr)
  raise RuntimeError('Command failed; private failure.log contains detail: '+args[0])
 return r.stdout
def sql(q):return run(['docker','exec','-i','supabase-db','psql','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],q.encode()).decode().strip()
def dump(args,name):
 with (root/name).open('wb') as f:
  r=subprocess.run(args,stdout=f,stderr=subprocess.PIPE)
 if r.returncode:
  (root/'failure.log').write_bytes(r.stderr);raise RuntimeError('Backup failed '+name)
before=json.loads(sql('select public.haru_snapshot();'))
(root/'snapshot-before.json').write_text(json.dumps(before))
dump(['docker','exec','supabase-db','pg_dumpall','-U','postgres','--roles-only'],'roles.sql')
dump(['docker','exec','supabase-db','pg_dump','-U','postgres','-d','postgres','-Fc'],'postgres.dump')
for database in json.loads(sql("select coalesce(json_agg(datname),'[]') from pg_database where not datistemplate and datallowconn and datname<>'postgres';")):
 dump(['docker','exec','supabase-db','pg_dump','-U','postgres','-d',database,'-Fc'],'database-'+hashlib.sha256(database.encode()).hexdigest()[:12]+'.dump')
(root/'databases.json').write_text(sql("select json_agg(datname) from pg_database where not datistemplate and datallowconn;"))
dump(['docker','exec','supabase-db','pg_dump','-U','postgres','-d','postgres','-n','journal','-Fc'],'journal.dump')
(root/'public-rpc.sql').write_text(sql("select pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace and proname in ('haru_snapshot','haru_command','haru_export') order by proname;")+'\n')
(root/'archive-list.txt').write_bytes(run(['docker','exec','-i','supabase-db','pg_restore','--list'],(root/'postgres.dump').read_bytes()))
ids=run(['docker','ps','-aq']).decode().split()
containers=json.loads(run(['docker','inspect']+ids))
(root/'containers-private.json').write_text(json.dumps(containers))
paths=[pathlib.Path('/opt/supabase'),pathlib.Path('/opt/haru-web'),pathlib.Path('/usr/local/lib/haru-operations')]
excluded=['opt/supabase/backups','opt/supabase/volumes/db/data','opt/supabase/.git']
def filt(info):
 if any(info.name==p or info.name.startswith(p+'/') for p in excluded):return None
 return info
with tarfile.open(root/'config-storage-web.tar.gz','w:gz') as t:
 for p in paths:t.add(p,arcname=str(p).lstrip('/'),filter=filt)
 for p in [pathlib.Path('/etc/caddy'),pathlib.Path('/etc/systemd/system')]:
  if p.exists():t.add(p,arcname=str(p).lstrip('/'))
 for c in containers:
  for m in c.get('Mounts',[]):
   if m['Destination']=='/etc/postgresql-custom':
    p=pathlib.Path(m['Source']);t.add(p,arcname='postgres-custom')
after=json.loads(sql('select public.haru_snapshot();'))
(root/'snapshot-after.json').write_text(json.dumps(after))
report={'backup':str(root),'snapshotUnchanged':before==after,'revision':after['revision'],'counts':{k:len(after.get(k,[])) for k in ['plans','tasks','placements','runs','thoughts','reflections','improvements']},'storageObjects':int(sql('select count(*) from storage.objects;')),'authUsers':int(sql('select count(*) from auth.users;')),'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in root.iterdir() if p.is_file()},'containers':[{'name':c['Name'],'image':c['Config']['Image'],'imageId':c['Image'],'status':c['State']['Status'],'health':c['State'].get('Health',{}).get('Status'),'restart':c['HostConfig']['RestartPolicy']['Name']} for c in containers],'freeGiB':round(shutil.disk_usage(root).free/2**30,1)}
(root/'backup-report.json').write_text(json.dumps(report,indent=2))
pathlib.Path('/tmp/haru-backup-result.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'backup':str(root),'snapshotUnchanged':before==after,'revision':after['revision'],'bytes':sum(x['bytes'] for x in report['files'].values())}))
