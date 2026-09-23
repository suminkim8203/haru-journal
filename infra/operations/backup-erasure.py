"""Root-only removal of expired accounts from managed diary backup files.
Default is inventory only. --apply uses the external deletion ledger and refuses
accounts still present in production. No account identifiers are printed.
"""
import datetime,fcntl,hashlib,json,os,re,shutil,subprocess,sys,uuid
from pathlib import Path
from archive_database import prepare_archive
from backup_snapshot import erase_snapshot
os.umask(0o077)
ROOTS=[Path('/backup/haru-operations'),Path('/opt/supabase/backups'),Path('/backup/haru-archive-preview')]
ROOTS += [p for p in Path('/backup').glob('haru-erasure-drill-*') if re.fullmatch(r'haru-erasure-drill-[a-f0-9]{32}',p.name)]
LEDGER=Path('/backup/haru-deletions/deleted-accounts.jsonl')
STATE=Path('/backup/haru-deletions/backup-erasure-state.json')
SNAPSHOTS={'snapshot-before.json','snapshot-after.json','restored-snapshot.json'}

def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write_atomic(p,data):
 tmp=p.with_name('.'+p.name+'.'+uuid.uuid4().hex+'.pending')
 with tmp.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 os.replace(tmp,p)
 fd=os.open(str(p.parent),os.O_RDONLY);os.fsync(fd);os.close(fd)
def live(q):
 p=subprocess.run(['docker','exec','-i','supabase-db','psql','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],input=q.encode(),capture_output=True)
 if p.returncode:raise RuntimeError('Production status check failed')
 return p.stdout.decode().strip()
def kind(p):
 if p.name in ('postgres.dump','database.dump') or p.name.endswith('.full.dump') or p.parent==ROOTS[2] and p.suffix=='.dump' and not p.name.endswith('.journal.dump'):return 'full'
 if p.name=='journal.dump' or p.name.endswith('.journal.dump'):return 'journal'
 if p.name=='journal-before.sql' or p.name.endswith('.journal.sql') or p.parent==ROOTS[2] and p.suffix=='.sql':return 'plain'
 if p.name in SNAPSHOTS:return 'snapshot'
 return None

def inventory():
 result=[]
 for root in ROOTS:
  if not root.exists():continue
  for p in root.rglob('*'):
   if p.is_symlink():raise RuntimeError('Symlink in managed backup tree; manual review required')
   if p.is_file() and kind(p):
    if not p.resolve().is_relative_to(root):raise RuntimeError('Backup path escaped managed root')
    result.append(p)
 # Journal-only archives need the original matching full archive as context.
 return sorted(set(result),key=lambda p:({'journal':0,'plain':0,'full':1,'snapshot':2}[kind(p)],str(p)))

def remove_stopped_drills():
 names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True).splitlines()
 for name in names:
  if not re.fullmatch(r'haru-(?:restore-(?:[0-9TZ]+|check-[0-9]+)|erase-[a-f0-9]{32})',name):continue
  info=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
  if info['State']['Running']:raise RuntimeError('Restore drill running; cleanup cannot be marked complete')
  subprocess.run(['docker','rm',name],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

def process(entry,state):
 user=str(uuid.UUID(entry['userId']));diary=str(uuid.UUID(entry['diaryId'])) if entry.get('diaryId') else '00000000-0000-0000-0000-000000000000'
 deadline=datetime.datetime.fromisoformat(entry['deleteAfter'].replace('Z','+00:00'))
 if deadline.tzinfo is None or deadline>datetime.datetime.now(datetime.timezone.utc):raise RuntimeError('Deletion deadline has not passed')
 if live("select count(*) from auth.users where id='%s';"%user)!='0':raise RuntimeError('Account still present; backup cleanup deferred')
 key=hashlib.sha256(user.encode()).hexdigest();done=state.setdefault(key,{'files':{},'complete':False});done['complete']=False
 files=inventory();full=[p for p in files if kind(p)=='full']
 if not full:raise RuntimeError('No database context available')
 context=max(full,key=lambda p:p.stat().st_mtime)
 touched=set();changed=0
 for p in files:
  touched.add(p.parent)
  before=digest(p);cache=done['files'].get(str(p))
  if cache and cache['sha256']==before:continue
  k=kind(p)
  if k=='snapshot':
   value=json.loads(p.read_text())
   if value.get('backupStateVersion') in (2,3):
    manifest=p.parent/'integrity-state.json'
    if not manifest.exists():raise RuntimeError('Sanitized manifest missing')
    output=manifest.read_bytes()
   else:output=json.dumps(erase_snapshot(value,diary)).encode()
   write_atomic(p,output)
  else:
   suffix='.journal.sql' if k=='plain' else '.journal.dump' if k=='journal' else '.full.dump'
   destination=p.parent/('.sanitize-'+uuid.uuid4().hex+suffix)
   seed=p.parent/'postgres.dump'
   if not seed.exists():seed=context
   result=prepare_archive(p,destination,user,diary,context=seed if k in ('journal','plain') else None,plain=k=='plain')
   if digest(p)!=before:raise RuntimeError('Source changed during cleanup')
   os.replace(destination,p)
   fd=os.open(str(p.parent),os.O_RDONLY);os.fsync(fd);os.close(fd)
   if k=='full':write_atomic(p.parent/'integrity-state.json',json.dumps(result['state']).encode())
  done['files'][str(p)]={'sha256':digest(p)};touched.add(p.parent);changed+=1
  write_atomic(STATE,json.dumps(state).encode())
 for folder in touched:
  report=folder/'backup-report.json'
  if report.exists():
   data=json.loads(report.read_text());manifest=folder/'integrity-state.json'
   if manifest.exists():data['counts']={k:v['rows'] for k,v in json.loads(manifest.read_text())['tables'].items()}
   data['files']={p.name:{'bytes':p.stat().st_size,'sha256':digest(p)} for p in folder.iterdir() if p.is_file() and p.name!='backup-report.json'}
   data['accountErasureApplied']=True;write_atomic(report,json.dumps(data,indent=2).encode())
 # Old stopped restore drills are redundant copies, not production containers.
 remove_stopped_drills()
 done['complete']=True;done['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 write_atomic(STATE,json.dumps(state).encode())
 return changed

def main(apply=False):
 if not os.path.ismount('/backup'):raise RuntimeError('Backup disk unavailable')
 if not apply:
  files=inventory();print(json.dumps({'managedFiles':len(files),'types':{k:sum(kind(p)==k for p in files) for k in ('full','journal','plain','snapshot')},'apply':False}));return
 with open('/backup/haru-backup-mutation.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  state=json.loads(STATE.read_text()) if STATE.exists() else {}
  entries={}
  if LEDGER.exists():
   for line in LEDGER.read_text().splitlines():
    if line.strip():
     row=json.loads(line);entries[str(uuid.UUID(row['userId']))]=row
  total=0
  for row in entries.values():total+=process(row,state)
  print(json.dumps({'expiredAccountsChecked':len(entries),'filesProcessed':total,'errors':0}))
if __name__=='__main__':main('--apply' in sys.argv)
