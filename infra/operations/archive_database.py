"""Isolated PostgreSQL archive editor. Never writes to source or production DB."""
import hashlib,json,os,re,subprocess,time,uuid
from pathlib import Path
from backup_state import journal_state

def call(args,data=None):
 p=subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError('Isolated archive operation failed; private output suppressed')
 return p.stdout

class ArchiveDatabase:
 def __init__(self):
  self.name='haru-erase-'+uuid.uuid4().hex
  self.role=call(['docker','exec','supabase-db','psql','-U','postgres','-d','postgres','-XqAt','-c','select rolname from pg_roles where oid=10;']).decode().strip()
  if not re.fullmatch('[a-z_][a-z0-9_]*',self.role):raise RuntimeError('Invalid role')
 def __enter__(self):
  image=call(['docker','inspect','supabase-db','--format','{{.Image}}']).decode().strip()
  call(['docker','run','-d','--name',self.name,'--network','none','--memory','512m','--cpus','0.5','--pids-limit','128','--user','postgres','--entrypoint','/bin/sh',image,'-c',f"initdb -D /tmp/erase-db -U {self.role} --auth=trust >/tmp/init.log 2>&1 && exec postgres -D /tmp/erase-db -c listen_addresses='' -c unix_socket_directories=/tmp -c shared_preload_libraries=pg_stat_statements,pg_net"])
  try:
   for _ in range(40):
    try:self.sql('select 1;');break
    except RuntimeError:time.sleep(1)
   else:raise RuntimeError('Isolated database did not start')
   roles=call(['docker','exec','supabase-db','pg_dumpall','-U','postgres','--roles-only']).decode()
   roles=re.sub(r'^CREATE ROLE '+re.escape(self.role)+r';\n','',roles,flags=re.M)
   self.sql(roles)
   return self
  except BaseException:
   call(['docker','stop',self.name]);raise
 def __exit__(self,*args):
  call(['docker','stop',self.name])
  # Ephemeral test database is reproducible from the unchanged source archive.
  call(['docker','rm',self.name])
 def sql(self,q):return call(['docker','exec','-i',self.name,'psql','-h','/tmp','-U',self.role,'-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],q.encode()).decode().strip()
 def restore(self,path):
  with Path(path).open('rb',buffering=0) as f:
   if f.read(5)!=b'PGDMP':raise RuntimeError('Expected PostgreSQL custom archive')
   f.seek(0)
   p=subprocess.run(['docker','exec','-i',self.name,'pg_restore','-h','/tmp','-U',self.role,'-d','postgres'],stdin=f,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  if p.returncode:
   Path('/tmp/haru-archive-restore-error.log').write_bytes(p.stderr)
   raise RuntimeError('Archive restore failed; no source changes')
 def restore_journal(self,path,plain=False):
  self.sql('drop schema if exists journal cascade;')
  if plain:self.sql(Path(path).read_text())
  else:self.restore(path)
 def dump(self,path,journal_only=False,plain=False):
  with Path(path).open('xb') as f:
   p=subprocess.run(['docker','exec',self.name,'pg_dump','-h','/tmp','-U',self.role,'-d','postgres']+([] if plain else ['-Fc'])+(['-n','journal'] if journal_only else []),stdout=f,stderr=subprocess.PIPE)
  if p.returncode:raise RuntimeError('Sanitized archive dump failed')
 def erase(self,user,diary):
  user=str(uuid.UUID(user));diary=str(uuid.UUID(diary))
  self.sql("select set_config('haru.erase_user','%s',false),set_config('haru.erase_diary','%s',false);"%(user,diary)+Path(__file__).with_name('erase-offline-account.sql').read_text())
  return journal_state(self.sql)

def prepare_archive(source,destination,user,diary,context=None,plain=False):
 source=Path(source).resolve();destination=Path(destination).resolve()
 if destination.exists() or source==destination:raise RuntimeError('Destination must be new')
 original=hashlib.sha256(source.read_bytes()).hexdigest()
 with ArchiveDatabase() as database:
  if context:
   database.restore(context);database.restore_journal(source,plain)
  else:database.restore(source)
  expected=database.erase(user,diary);database.dump(destination,bool(context),plain)
 with ArchiveDatabase() as verification:
  if context:
   verification.restore(context);verification.restore_journal(destination,plain)
   # A journal-only archive cannot remove Auth rows from its independent seed.
  else:verification.restore(destination)
  if journal_state(verification.sql)!=expected:raise RuntimeError('Sanitized archive verification failed')
  if verification.sql("select to_regclass('journal.diaries') is not null;")=='t' and verification.sql("select count(*) from journal.diaries where id='%s';"%str(uuid.UUID(diary)))!='0':raise RuntimeError('Target diary remains')
  if not context and verification.sql("select to_regclass('auth.users') is not null;")=='t' and verification.sql("select count(*) from auth.users where id='%s';"%str(uuid.UUID(user)))!='0':raise RuntimeError('Target account remains')
 if hashlib.sha256(source.read_bytes()).hexdigest()!=original:raise RuntimeError('Source archive changed')
 return {'sourceUnchanged':True,'otherJournalRowsPreserved':True,'sanitizedArchiveVerified':True,'destinationSha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'state':expected}
