import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const id=(n:number)=>'90000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('staged private RPC separates both accounts and rejects foreign mutations without side effects',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,encrypted_password text);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,not_after timestamptz);
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;`);
 for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const f of ['01_session_boundary.sql','02_private_rpc_cutover.sql','03_private_read.sql','04_account_setup.sql','05_password_revocation.sql','07_account_deletion.sql','08_account_purge.sql'])await db.exec(await readFile(new URL('../supabase/staged-t07/'+f,import.meta.url),'utf8'));
 for(const n of [1,2]){
 await db.query('insert into auth.users(id,email_confirmed_at) values ($1,now())',[id(n)]);await db.query('insert into auth.sessions values ($1,$2,now(),null)',[id(n+10),id(n)]);
 await db.query('insert into journal.diaries(id) values ($1)',[id(n+20)]);await db.query('insert into journal.account_diaries(user_id,diary_id) values ($1,$2)',[id(n),id(n+20)]);
 }
 const login=async(n:number)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(n),session_id:id(n+10),amr:[{method:'password'}]})]);await db.exec('set role authenticated')};
 const command=async(n:number,rev:number,c:string,p:object)=>(await db.query<{v:{entityId:string}}>('select public.haru_command($1,$2,$3,$4::jsonb) v',[id(n+100),rev,c,JSON.stringify(p)])).rows[0].v;
 const snapshot=async()=>(await db.query<{v:{diaryId:string;plans:{id:string;title:string}[];revision:number}}>('select public.haru_snapshot() v')).rows[0].v;
 const plans:string[]=[];
 for(const n of [1,2]){await login(n);plans.push((await command(n,0,'create_plan',{kind:'general',title:'계획 '+n,startDate:'2026-09-22',endDate:'2026-09-30'})).entityId)}
 for(const n of [1,2]){
 await login(n);const own=await snapshot();assert.equal(own.diaryId,id(n+20));assert.equal(own.plans.length,1);assert.equal(own.plans[0].id,plans[n-1]);
 const foreign=plans[2-n];
 const read=async(resource:string)=>(await db.query<{v:{id:string;title:string}}>('select public.haru_resource($1,$2) v',['plan',resource])).rows[0].v;
 assert.equal((await read(plans[n-1])).title,'계획 '+n);
 await assert.rejects(read(foreign),{code:'PT404'});
 await assert.rejects(read(id(999)),{code:'PT404'});
 await assert.rejects(command(n+3,1,'update_plan',{planId:foreign,title:'변경',startDate:'2026-09-22',endDate:'2026-09-30'}),{code:'PT404'});
 await assert.rejects(command(n+5,1,'delete_entity',{entityType:'plan',entityId:foreign}),{code:'PT404'});
 await assert.rejects(command(n+7,1,'create_task',{planId:foreign,title:'침범'}),{code:'PT404'});
 assert.deepEqual(await snapshot(),own);
 const exported=(await db.query<{v:{diaryId:string}}>('select public.haru_export() v')).rows[0].v;assert.equal(exported.diaryId,id(n+20));
 // Untrusted ownership hints cannot override the identity established by verified JWT claims.
 // This is SQL-boundary coverage, not a real HTTP/PostgREST URL or header test.
 const other=3-n;
 await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-user-id':id(other),'x-owner-id':id(other),'x-diary-id':id(other+20)})]);
 assert.deepEqual(await snapshot(),own);
 await assert.rejects(read(foreign),{code:'PT404'});
 await assert.rejects(db.query('select * from journal.plans'),{code:'42501'});
 await db.exec('begin');
 try{
  await command(n+30,own.revision,'update_plan',{planId:plans[n-1],title:'본인 계획 수정',startDate:'2026-09-22',endDate:'2026-09-30',userId:id(other),user_id:id(other),ownerId:id(other),diaryId:id(other+20),diary_id:id(other+20)});
  const changed=await snapshot();assert.equal(changed.diaryId,own.diaryId);assert.equal(changed.plans.length,1);assert.equal(changed.plans[0].id,plans[n-1]);assert.equal(changed.plans[0].title,'본인 계획 수정');
  await login(other);const otherData=await snapshot();assert.equal(otherData.plans.length,1);assert.equal(otherData.plans[0].id,foreign);assert.equal(otherData.plans[0].title,'계획 '+other);
 }finally{await db.exec('rollback');}
 await login(n);assert.deepEqual(await snapshot(),own);
 await db.query("select set_config('request.headers','{}',false)");
 }
 await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[id(12)]);await db.exec('set role authenticated');await assert.rejects(snapshot(),{code:'PT401'});
 await db.exec('reset role');
 await db.query('insert into auth.users(id,email_confirmed_at) values ($1,now())',[id(3)]);
 await db.query('insert into auth.sessions values ($1,$2,now(),null)',[id(13),id(3)]);
 await login(3);
 const setup=async()=>(await db.query<{v:string}>('select public.haru_setup_account() v')).rows[0].v;
 const diary=await setup();assert.equal(await setup(),diary);
 assert.notEqual(diary,'00000000-0000-4000-8000-000000000006');
 assert.equal((await snapshot()).plans.length,0);
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(3),session_id:id(13),amr:[{method:'otp'}]})]);
 await db.exec('set role authenticated');await assert.rejects(setup(),{code:'PT403'});
 await db.exec('reset role');
 await login(1);await snapshot();
 await db.exec('reset role');await db.query("update auth.users set encrypted_password='test-only-opaque-hash' where id=$1",[id(1)]);
 await db.exec('set role authenticated');await assert.rejects(snapshot(),{code:'PT401'});
 await db.exec('reset role');await db.query('update auth.sessions set created_at=clock_timestamp() where id=$1',[id(11)]);
 await db.exec('set role authenticated');assert.equal((await snapshot()).plans.length,1);
 await db.exec('reset role;set role anon');await assert.rejects(snapshot(),{code:'42501'});
 }finally{await db.close()}
});
