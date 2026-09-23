"""Run as root on NAS. No credentials in args/logs. Backup erasure runs after the live purge.
Restore protocol: keep app offline; merge latest external deletion ledger before
opening restored DB. Do not restore this ledger from an older database backup.
"""
import json,os,subprocess,uuid,fcntl
from pathlib import Path
os.umask(0o077)
ROOT=Path('/backup/haru-deletions')
def sql(query):
 result=subprocess.run(['docker','exec','-i','supabase-db','psql','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],input=query.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if result.returncode:raise RuntimeError('Deletion DB operation failed; no credentials logged')
 return result.stdout.decode().strip()
def main():
 if not os.path.ismount('/backup'):raise RuntimeError('Backup disk not mounted; deletion refused')
 ROOT.mkdir(mode=0o700,exist_ok=True)
 with (ROOT/'worker.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  rows=json.loads(sql("select coalesce(json_agg(x),'[]') from (select a.user_id,a.delete_after,d.diary_id from journal.account_deletions a left join journal.account_diaries d using(user_id) where a.delete_after<=clock_timestamp()) x;"))
  count=0
  for row in rows:
   user=str(uuid.UUID(row['user_id']));diary=str(uuid.UUID(row['diary_id'])) if row['diary_id'] else None
   # External append-only tombstone must be durable BEFORE DB deletion.
   with (ROOT/'deleted-accounts.jsonl').open('a') as ledger:
    ledger.write(json.dumps({'userId':user,'diaryId':diary,'deleteAfter':row['delete_after']})+'\n');ledger.flush();os.fsync(ledger.fileno())
   directory=os.open(str(ROOT),os.O_RDONLY);os.fsync(directory);os.close(directory)
   target="'%s'::uuid"%diary if diary else 'null::uuid'
   if sql("select journal.purge_due_account('%s'::uuid,%s);"%(user,target))=='t':count+=1
  print(json.dumps({'due':len(rows),'deleted':count}))
if __name__=='__main__':
 main()
 subprocess.run(['python3',str(Path(__file__).with_name('backup-erasure.py')),'--apply'],check=True)
