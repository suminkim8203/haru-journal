import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const id=(n:number)=>'91000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('deletion grace locks records, revokes all sessions, requires explicit timely cancellation and isolates purge',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,encrypted_password text);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,not_after timestamptz);
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;`);
 for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const f of ['01_session_boundary.sql','02_private_rpc_cutover.sql','03_private_read.sql','04_account_setup.sql','05_password_revocation.sql','07_account_deletion.sql','08_account_purge.sql'])await db.exec(await readFile(new URL('../supabase/staged-t07/'+f,import.meta.url),'utf8'));
 async function login(n:number){await db.exec('reset role');await db.query('insert into auth.sessions values($1,$2,clock_timestamp(),null) on conflict(id) do update set created_at=clock_timestamp()',[id(n+10),id(n)]);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(n),session_id:id(n+10),amr:[{method:'password'}]})]);await db.exec('set role authenticated');}
 for(const n of [1,2]){await db.exec('reset role');await db.query('insert into auth.users values($1,now(),null)',[id(n)]);await login(n);await db.query('select public.haru_setup_account()');await db.query('select public.haru_command($1,0,\'create_plan\',$2)',[id(n+100),JSON.stringify({title:'test '+n,kind:'general',startDate:'2026-09-22',endDate:'2026-09-26'})]);}
 await login(1);const before=await db.query('select public.haru_snapshot()');
 const requested=await db.query<{v:{deleteAfter:string}}>('select public.haru_request_deletion() v');assert.ok(requested.rows[0].v.deleteAfter);
 await assert.rejects(db.query('select public.haru_snapshot()'),{code:'PT401'});
 await login(1);assert.equal((await db.query<{v:{state:string}}>('select public.haru_account_status() v')).rows[0].v.state,'pending');
 for(const fn of ['haru_snapshot','haru_setup_account','haru_export'])await assert.rejects(db.query('select public.'+fn+'()'),{code:'PT423'});
 await db.query('select public.haru_cancel_deletion()');assert.deepEqual(await db.query('select public.haru_snapshot()'),before);
 await db.exec('reset role');await db.query("update auth.sessions set created_at=now()-interval '3 minutes' where id=$1",[id(11)]);await db.exec('set role authenticated');await assert.rejects(db.query('select public.haru_request_deletion()'),{code:'PT403'});
 await login(1);await db.query('select public.haru_request_deletion()');await login(1);
 await db.exec('reset role');const diary=(await db.query<{diary_id:string}>('select diary_id from journal.account_diaries where user_id=$1',[id(1)])).rows[0].diary_id;
 assert.equal((await db.query<{v:boolean}>('select journal.purge_due_account($1,$2) v',[id(1),diary])).rows[0].v,false);
 await db.query("update journal.account_deletions set requested_at=now()-interval '169 hours',delete_after=now()-interval '1 hour' where user_id=$1",[id(1)]);await db.exec('set role authenticated');
 await assert.rejects(db.query('select public.haru_cancel_deletion()'),{code:'PT410'});
 await assert.rejects(db.query('select journal.purge_due_account($1,$2)',[id(1),diary]),{code:'42501'});
 await db.exec('reset role');assert.equal((await db.query<{v:boolean}>('select journal.purge_due_account($1,$2) v',[id(1),diary])).rows[0].v,true);
 assert.equal((await db.query('select * from auth.users where id=$1',[id(1)])).rows.length,0);
 assert.equal((await db.query('select * from journal.plans where diary_id=$1',[diary])).rows.length,0);
 await login(2);assert.equal((await db.query<{v:{plans:unknown[]}}>('select public.haru_snapshot() v')).rows[0].v.plans.length,1);
 }finally{await db.close();}
});
