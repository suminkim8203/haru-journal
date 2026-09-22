import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
const id=(n:number)=>'90000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('staged private RPC separates both accounts and rejects foreign mutations without side effects',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,not_after timestamptz);
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;`);
 for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const f of ['01_session_boundary.sql','02_private_rpc_cutover.sql'])await db.exec(await readFile(new URL('../supabase/staged-t07/'+f,import.meta.url),'utf8'));
 for(const n of [1,2]){
 await db.query('insert into auth.users values ($1,now())',[id(n)]);await db.query('insert into auth.sessions values ($1,$2,now(),null)',[id(n+10),id(n)]);
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
 await assert.rejects(command(n+3,1,'update_plan',{planId:foreign,title:'변경',startDate:'2026-09-22',endDate:'2026-09-30'}),{code:'PT404'});
 await assert.rejects(command(n+5,1,'delete_entity',{entityType:'plan',entityId:foreign}),{code:'PT404'});
 await assert.rejects(command(n+7,1,'create_task',{planId:foreign,title:'침범'}),{code:'PT404'});
 assert.deepEqual(await snapshot(),own);
 const exported=(await db.query<{v:{diaryId:string}}>('select public.haru_export() v')).rows[0].v;assert.equal(exported.diaryId,id(n+20));
 }
 await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[id(12)]);await db.exec('set role authenticated');await assert.rejects(snapshot(),{code:'PT401'});
 await db.exec('reset role;set role anon');await assert.rejects(snapshot(),{code:'42501'});
 }finally{await db.close()}
});
