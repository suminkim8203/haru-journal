import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migrations=['0001_core.sql','0002_plan_priority_task_tags.sql','0003_schedule_runs.sql','0004_records_archive.sql','0005_export.sql','0006_supabase_backend.sql','0007_deferred_segment_validation.sql'];
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(){const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;');for(const f of migrations)await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));return db;}
async function call(db:PGlite,n:number,rev:number,c:string,p:unknown){return (await db.query<{v:{entityId:string;revision:number}}>('select public.haru_command($1,$2,$3,$4::jsonb) v',[id(n),rev,c,JSON.stringify(p)])).rows[0].v;}
const plan={kind:'general',title:'공개 다이어리 검증',startDate:'2026-09-18',endDate:'2026-09-30'};
test('anon uses only fixed-diary Supabase APIs and cannot access private tables or core functions',async()=>{const db=await setup();try{
 await db.exec(`insert into journal.diaries(id) values ('${id(99)}');set role anon;`);
 const p=await call(db,1,0,'create_plan',plan);assert.ok(p.entityId);
 const s=(await db.query<{v:{diaryId:string;revision:number}}>('select public.haru_snapshot() v')).rows[0].v;assert.equal(s.diaryId,id(6));assert.equal(s.revision,1);
 await assert.rejects(db.query('select * from journal.plans'),/permission denied/);
 await assert.rejects(db.query('select journal.core_command_v4($1,$2,0,$3,$4::jsonb)',[id(99),id(2),'create_plan',JSON.stringify(plan)]),/permission denied/);
 await assert.rejects(db.query('select public.journal_snapshot($1)',[id(99)]),/does not exist/);
 const exportValue=(await db.query<{v:Record<string,unknown>}>('select public.haru_export() v')).rows[0].v;assert.equal(exportValue.diaryId,id(6));assert.equal('command_receipts' in exportValue,false);
 await db.exec('reset role');assert.equal((await db.query<{n:number}>('select count(*)::int n from journal.plans where diary_id=$1',[id(99)])).rows[0].n,0);
 }finally{await db.close()}});
test('Supabase rejects forged input without client validation and failed writes leave revision unchanged',async()=>{const db=await setup();try{
 await db.exec('set role anon');
 for(const p of [{...plan,title:42},{...plan,successText:{}},{...plan,estimatedMinutes:'30'},{...plan,startDate:'2026-02-30'},{...plan,title:'x'.repeat(121)},{...plan,priority:'urgent'}])await assert.rejects(call(db,1,0,'create_plan',p));
 await assert.rejects(call(db,2,0,'unknown',{}));
 assert.equal((await db.query<{v:{revision:number}}>('select public.haru_snapshot() v')).rows[0].v.revision,0);
 const p=await call(db,3,0,'create_plan',plan);
 await assert.rejects(call(db,4,1,'create_task',{planId:p.entityId,title:'할 일',dueDate:null}));
 const t=await call(db,4,1,'create_task',{planId:p.entityId,title:'할 일',tags:['독서',' 독서 ','공부']});
 await assert.rejects(call(db,5,2,'set_task_complete',{taskId:t.entityId,complete:'true'}));
 const s=(await db.query<{v:{revision:number;tasks:{tags:unknown[]}[]}}>('select public.haru_snapshot() v')).rows[0].v;assert.equal(s.revision,2);assert.equal(s.tasks[0].tags.length,2);
 }finally{await db.close()}});
test('public RPC preserves atomic completion, exact retries and manual time boundaries',async()=>{const db=await setup();try{
 await db.exec('set role anon');const p=await call(db,1,0,'create_plan',plan),t=await call(db,2,1,'create_task',{planId:p.entityId,title:'작업'});
 await call(db,3,2,'start_run',{taskId:t.entityId,at:'2026-09-18T00:00:00.000Z'});
 const payload={taskId:t.entityId,complete:true,at:'2026-09-18T00:30:00.000Z'},result=await call(db,4,3,'set_task_complete',payload);
 assert.deepEqual(await call(db,4,3,'set_task_complete',payload),result);
 await assert.rejects(call(db,5,4,'start_run',{taskId:t.entityId,at:'2026-09-18T01:00:00.000Z'}));
 await assert.rejects(call(db,6,4,'create_run',{taskId:t.entityId,startedAt:'2026-09-18T01:00:00.000Z',endedAt:'2026-09-18T01:30:00.000Z',segments:[{kind:'break',startedAt:'2026-09-18T01:00:00.000Z',endedAt:'2026-09-18T02:00:00.000Z'}]}));
 const s=(await db.query<{v:{revision:number;runs:{work_seconds:number;ended_at:string}[]}}>('select public.haru_snapshot() v')).rows[0].v;assert.equal(s.revision,4);assert.equal(s.runs.length,1);assert.equal(s.runs[0].work_seconds,1800);assert.ok(s.runs[0].ended_at);
 }finally{await db.close()}});

test('deferred segment validation commits as anon without exposing private access',async()=>{const db=await setup();try{
 const metadata=(await db.query<{definer:boolean}>('select prosecdef as definer from pg_proc where oid=\'journal.check_run_segments()\'::regprocedure')).rows[0];assert.equal(metadata.definer,true);
 await db.exec('begin;set local role anon');const p=await call(db,1,0,'create_plan',plan),t=await call(db,2,1,'create_task',{planId:p.entityId,title:'수기 실행'});
 await call(db,3,2,'create_run',{taskId:t.entityId,startedAt:'2026-09-18T00:00:00.000Z',endedAt:'2026-09-18T00:25:00.000Z',segments:[{kind:'work',startedAt:'2026-09-18T00:00:00.000Z',endedAt:'2026-09-18T00:25:00.000Z'}]});await db.exec('commit');
 await db.exec('set role anon');const s=(await db.query<{v:{revision:number;runs:{work_seconds:number}[]}}>('select public.haru_snapshot() v')).rows[0].v;assert.equal(s.revision,3);assert.equal(s.runs[0].work_seconds,1500);
 await assert.rejects(db.query('select * from journal.runs'),/permission denied/);await assert.rejects(db.query('select journal.check_run_segments()'),/permission denied/);
 }finally{await db.close()}});
