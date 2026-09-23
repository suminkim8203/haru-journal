"""Prepare, never replace, a sanitized regular backup on the NAS.
Requires a canonical private backup. Original dumps remain untouched.
"""
import argparse,fcntl,hashlib,json,os,re,shutil,subprocess,tarfile,time,uuid
from pathlib import Path
from backup_state import journal_state
os.umask(0o077)

def run(args,data=None):
 p=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,"HARU_BACKUP_LOCK_HELD":"1"})
 if p.returncode:raise RuntimeError('Backup preparation failed; sensitive command output suppressed')
 return p.stdout

def prepare(source,user,diary):
 source=Path(source).resolve();user=str(uuid.UUID(user));diary=str(uuid.UUID(diary))
 base=Path('/backup/haru-operations')
 if not os.path.ismount('/backup') or not source.is_relative_to(base) or source==base:raise RuntimeError('Invalid backup source')
 if json.loads((source/'snapshot-before.json').read_text()).get('backupStateVersion')!=3:raise RuntimeError('Legacy backup requires separate verified migration')
 originals={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file() and p.suffix in ('.dump','.gz','.sql')}
 with open('/backup/haru-backup-mutation.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  run(['python3',str(Path(__file__).with_name('restore-check.py')),str(source)])
  report=json.loads((source/'restore-report.json').read_text());name=report['container']
  if not re.fullmatch(r'haru-restore-[0-9TZ]+',name) or not report.get('allJournalTablesExact'):raise RuntimeError('Unverified restore')
  info=json.loads(run(['docker','inspect',name]))[0]
  if info['HostConfig']['NetworkMode']!='none' or info['HostConfig'].get('PortBindings'):raise RuntimeError('Restore isolation missing')
  bootstrap=run(['docker','exec','supabase-db','psql','-U','postgres','-d','postgres','-XqAt','-c','select rolname from pg_roles where oid=10;']).decode().strip()
  if not re.fullmatch('[a-z_][a-z0-9_]*',bootstrap):raise RuntimeError('Invalid bootstrap role')
  def sql(q):return run(['docker','exec','-i',name,'psql','-h','/tmp','-U',bootstrap,'-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],q.encode()).decode().strip()
  stage=base/('.erasure-preview-'+uuid.uuid4().hex)
  shutil.copytree(source,stage)
  run(['docker','start',name])
  try:
   for _ in range(40):
    try:sql('select 1;');break
    except RuntimeError:time.sleep(1)
   else:raise RuntimeError('Restore did not start')
   sql("select set_config('haru.erase_user','%s',false),set_config('haru.erase_diary','%s',false);"%(user,diary)+Path(__file__).with_name('erase-offline-account.sql').read_text())
   if sql("select count(*) from auth.users where id='%s';"%user)!='0' or sql("select count(*) from journal.diaries where id='%s';"%diary)!='0':raise RuntimeError('Target remains')
   state=journal_state(sql)
   for filename,extra in [('postgres.dump',[]),('journal.dump',['-n','journal'])]:
    with (stage/filename).open('wb') as out:
     p=subprocess.run(['docker','exec',name,'pg_dump','-h','/tmp','-U',bootstrap,'-d','postgres','-Fc']+extra,stdout=out,stderr=subprocess.PIPE)
    if p.returncode:raise RuntimeError('Sanitized dump failed')
   for filename in ['snapshot-before.json','snapshot-after.json','restored-snapshot.json']:
    if (stage/filename).exists():(stage/filename).write_text(json.dumps(state))
   # Old private restore logs are not carried into the new preview. Originals remain.
   for p in stage.glob('*restore*.log'):p.write_text('Replaced by sanitized restore verification.\n')
   archive=stage/'config-storage-web.tar.gz'
   with tarfile.open(archive,'r:gz') as t:
    for member in t:
     if member.isfile():
      data=t.extractfile(member).read()
      if user.encode() in data or diary.encode() in data:raise RuntimeError('Archive contains target identifiers; manual typed sanitizer required')
   b=json.loads((stage/'backup-report.json').read_text());b.update(backup=str(stage),snapshotUnchanged=True,counts={k:v['rows'] for k,v in state['tables'].items()},authUsers=int(sql('select count(*) from auth.users;')))
   b['files']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in stage.iterdir() if p.is_file() and p.name not in ('backup-report.json','restore-report.json')}
   (stage/'backup-report.json').write_text(json.dumps(b,indent=2))
  finally:run(['docker','stop',name])
  run(['python3',str(Path(__file__).with_name('restore-check.py')),str(stage)])
  verified=json.loads((stage/'restore-report.json').read_text())
  if not verified.get('allJournalTablesExact'):raise RuntimeError('Sanitized backup restore mismatch')
  if originals!={n:hashlib.sha256((source/n).read_bytes()).hexdigest() for n in originals}:raise RuntimeError('Original backup changed')
  result={'preview':str(stage),'originalPayloadsUnchanged':True,'otherJournalRowsUnchanged':True,'sanitizedRestoreVerified':True,'productionChanged':False,'automaticReplacementEnabled':False}
  (stage/'erasure-preview-report.json').write_text(json.dumps(result,indent=2))
  return result

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('user');p.add_argument('diary');a=p.parse_args();print(json.dumps(prepare(a.source,a.user,a.diary)))
