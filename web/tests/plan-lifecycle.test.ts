import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {planStatus,completedPlanHidden} from '../src/lib/calendar-plans.ts';
import type {Snapshot,Plan} from '../src/lib/contracts.ts';

const id=(n:number)=>'91000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('plan marker stays stable and explicit closure blocks new work without changing completion counts',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz,encrypted_password text);
   create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,not_after timestamptz);
   create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;`);
  for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())
   await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  for(const f of ['01_session_boundary.sql','02_private_rpc_cutover.sql','09_plan_lifecycle_marker.sql'])
   await db.exec(await readFile(new URL('../supabase/staged-t07/'+f,import.meta.url),'utf8'));
  for(const n of [1,2]){
   await db.query('insert into auth.users(id,email_confirmed_at) values ($1,now())',[id(n)]);
   await db.query('insert into auth.sessions values ($1,$2,now(),null)',[id(n+10),id(n)]);
   await db.query('insert into journal.diaries(id) values ($1)',[id(n+20)]);
   await db.query('insert into journal.account_diaries(user_id,diary_id) values ($1,$2)',[id(n),id(n+20)]);
  }
  const login=async(n:number)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(n),session_id:id(n+10),amr:[{method:'password'}]})]);await db.exec('set role authenticated')};
  let serial=100,revision=0;
  const command=async(name:string,payload:object,request=id(++serial),expected=revision)=>{
   const result=(await db.query<{v:{entityId:string;revision:number}}>('select public.haru_command($1,$2,$3,$4::jsonb) v',[request,expected,name,JSON.stringify(payload)])).rows[0].v;
   revision=result.revision;return result;
  };
  const snap=async()=>(await db.query<{v:Snapshot}>('select public.haru_snapshot() v')).rows[0].v;
  await login(1);
  const first=await command('create_plan',{kind:'general',title:'첫 계획',startDate:'2026-09-20',endDate:'2026-09-30'});
  const second=await command('create_plan',{kind:'general',title:'둘째 계획',startDate:'2026-09-20',endDate:'2026-09-30'});
  const task=await command('create_task',{planId:first.entityId,title:'남은 할 일'});
  let current=await snap();
  assert.deepEqual(current.plans.map(p=>p.marker_color),['warm','gold']);
  await command('set_plan_marker',{planId:first.entityId,markerColor:'blue'});
  const closed=await command('close_plan',{planId:first.entityId});
  assert.equal((await snap()).plans[0].marker_color,'blue');
  assert.ok((await snap()).plans[0].closed_at);
  assert.equal((await snap()).tasks.find(t=>t.id===task.entityId)?.complete,false);
  await assert.rejects(command('create_task',{planId:first.entityId,title:'새 할 일'}),{code:'22023'});
  await assert.rejects(command('start_run',{taskId:task.entityId,at:'2026-09-29T01:00:00.000Z'}),{code:'22023'});
  assert.equal((await snap()).revision,closed.revision);
  await login(2);revision=0;
  await assert.rejects(command('close_plan',{planId:first.entityId}),{code:'PT404'});
  await login(1);revision=(await snap()).revision;
  await command('reopen_plan',{planId:first.entityId});
  current=await snap();
  assert.equal(current.plans[0].closed_at,null);
  assert.equal(current.plans[0].marker_color,'blue');
  assert.equal(current.plans[1].id,second.entityId);
 }finally{await db.close()}
});

test('daily grouping distinguishes completed, overdue, and manually ended plans',()=>{
 const plan={id:id(1),kind:'general',start_date:'2026-09-20',end_date:'2026-09-25',closed_at:null} as Plan;
 const task={id:id(2),plan_id:plan.id,complete:false,completed_at:null,skipped:false,cancelled_at:null};
 const data={plans:[plan],tasks:[task]} as unknown as Snapshot;
 assert.equal(planStatus(data,plan,'2026-09-26'),'overdue');
 assert.equal(completedPlanHidden(data,plan,'2026-09-26'),false);
 data.tasks[0].complete=true;data.tasks[0].completed_at='2026-09-24T01:00:00.000Z';
 assert.equal(planStatus(data,plan,'2026-09-26'),'completed');
 assert.equal(completedPlanHidden(data,plan,'2026-09-26'),true);
 data.tasks[0].complete=false;data.tasks[0].completed_at=null;plan.closed_at='2026-09-25T01:00:00.000Z';
 assert.equal(planStatus(data,plan,'2026-09-26'),'closed');
 assert.equal(completedPlanHidden(data,plan,'2026-09-26'),true);
});
