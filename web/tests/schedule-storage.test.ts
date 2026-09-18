import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {DIARY_ID,parseCommand,type Snapshot} from '../src/lib/contracts.ts';
import {dayWindow,localInstant,manualSegments,runWork,weekDays} from '../src/lib/schedule.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture(){const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;');for(const file of ['0001_core.sql','0002_plan_priority_task_tags.sql','0003_schedule_runs.sql','0004_records_archive.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));let n=0,revision=0;
 const send=async(command:string,payload:unknown,requestId=id(++n),expected=revision)=>{const r=(await db.query<{data:{entityId:string;revision:number}}>('select public.journal_command($1,$2,$3,$4,$5::jsonb) data',[DIARY_ID,requestId,expected,command,JSON.stringify(payload)])).rows[0].data;revision=r.revision;return r;};
 const snapshot=async()=>(await db.query<{data:Snapshot}>('select public.journal_snapshot($1) data',[DIARY_ID])).rows[0].data;
 const p=await send('create_plan',{kind:'general',title:'계획',startDate:'2026-09-18',endDate:'2026-09-30',estimatedMinutes:100});const t=await send('create_task',{planId:p.entityId,title:'할 일',estimatedMinutes:30});return {db,send,snapshot,taskId:t.entityId};}
test('live completion atomically closes last segment, retries once and undo does not reopen',async()=>{const f=await fixture();try{
 const run=await f.send('start_run',{taskId:f.taskId,at:'2026-09-18T00:00:00.000Z'});
 await f.send('switch_segment',{runId:run.entityId,at:'2026-09-18T00:10:00.000Z',kind:'break'});
 await f.send('switch_segment',{runId:run.entityId,at:'2026-09-18T00:15:00.000Z',kind:'work'});
 const before=await f.snapshot(),payload={taskId:f.taskId,complete:true,at:'2026-09-18T00:30:00.000Z',blockedReason:'자료 부족'};
 const completed=await f.send('set_task_complete',payload,id(900),before.revision);
 assert.deepEqual(await f.send('set_task_complete',payload,id(900),before.revision),completed);
 let s=await f.snapshot();assert.equal(s.tasks[0].complete,true);assert.equal(s.runs[0].work_seconds,1500);assert.equal(s.runs[0].segments.length,3);assert.ok(s.runs[0].segments.every(p=>p.ended_at));assert.equal(s.runs[0].blocked_reason,'자료 부족');
 assert.equal(s.plans[0].estimated_minutes,100);assert.equal(s.tasks[0].estimated_minutes,30);
 await assert.rejects(f.send('start_run',{taskId:f.taskId,at:'2026-09-18T01:00:00Z'}),/Completed task/);
 await assert.rejects(f.send('create_placement',{taskId:f.taskId,startedAt:'2026-09-18T01:00:00Z',endedAt:'2026-09-18T02:00:00Z'}),/Completed task/);
 await f.send('set_task_complete',{taskId:f.taskId,complete:false});s=await f.snapshot();assert.ok(s.runs[0].ended_at);await f.send('start_run',{taskId:f.taskId,at:'2026-09-18T01:00:00Z'});assert.equal((await f.snapshot()).runs.length,2);
}finally{await f.db.close();}});
test('invalid completion/end rolls back both completion and run and keeps request retryable',async()=>{const f=await fixture();try{
 await f.send('start_run',{taskId:f.taskId,at:'2026-09-18T00:00:00Z'});const before=await f.snapshot();
 await assert.rejects(f.send('set_task_complete',{taskId:f.taskId,complete:true,at:'2026-09-17T23:59:00Z'},id(800),before.revision));assert.deepEqual(await f.snapshot(),before);
 await f.send('set_task_complete',{taskId:f.taskId,complete:true,at:'2026-09-18T00:30:00Z'},id(800),before.revision);
}finally{await f.db.close();}});
test('one live run per diary; completing a different task leaves it running; stop does not complete',async()=>{const f=await fixture();try{
 const before=await f.snapshot(),other=await f.send('create_task',{planId:before.plans[0].id,title:'다른 할 일'});
 const run=await f.send('start_run',{taskId:f.taskId,at:'2026-09-18T00:00:00Z'});await assert.rejects(f.send('start_run',{taskId:other.entityId,at:'2026-09-18T00:05:00Z'}));
 await f.send('set_task_complete',{taskId:other.entityId,complete:true});assert.equal((await f.snapshot()).runs[0].ended_at,null);
 await f.send('stop_run',{runId:run.entityId,at:'2026-09-18T00:10:00Z',blockedReason:'중단'});const s=await f.snapshot();assert.equal(s.tasks.find(t=>t.id===f.taskId)!.complete,false);assert.equal(s.runs[0].work_seconds,600);
}finally{await f.db.close();}});
test('manual runs permit completed tasks, validate containment/overlap/gaps at SQL and audit before edit',async()=>{const f=await fixture();try{
 await f.send('set_task_complete',{taskId:f.taskId,complete:true});const start='2026-09-18T00:00:00.000Z',end='2026-09-18T01:00:00.000Z';
 const segments=manualSegments(start,end,[{kind:'interrupt',start:'2026-09-18T00:10:00.000Z',end:'2026-09-18T00:20:00.000Z'}]);
 const payload={taskId:f.taskId,startedAt:start,endedAt:end,segments,blockedReason:'집중 부족'},run=await f.send('create_run',payload);assert.equal((await f.snapshot()).runs[0].work_seconds,3000);
 const before=await f.snapshot();for(const broken of [[{kind:'work',startedAt:start,endedAt:'2026-09-18T02:00:00Z'}],segments.slice(1),[{...segments[0],endedAt:'2026-09-18T00:15:00Z'},...segments.slice(1)]]){
  await assert.rejects(f.send('update_run',{...payload,runId:run.entityId,segments:broken}));assert.deepEqual(await f.snapshot(),before);}
 await f.send('update_run',{...payload,runId:run.entityId,blockedReason:''});assert.equal((await f.snapshot()).runs[0].blocked_reason,'');
 const history=await f.db.query<{value:{blocked_reason:string;segments:unknown[]}}>("select previous_value value from journal.revisions where entity_type='run'");assert.equal(history.rows[0].value.blocked_reason,'집중 부족');assert.equal(history.rows[0].value.segments.length,3);
}finally{await f.db.close();}});
test('placements stay independent from runs; private helpers and execution tables deny anonymous access',async()=>{const f=await fixture();try{
 await f.send('create_placement',{taskId:f.taskId,startedAt:'2026-09-18T00:00:00Z',endedAt:'2026-09-18T01:00:00Z'});await f.send('start_run',{taskId:f.taskId,at:'2026-09-18T01:00:00Z'});const s=await f.snapshot();assert.equal(s.placements.length,1);assert.equal(s.runs.length,1);assert.equal(s.runs[0].work_seconds,null);
 await f.db.exec('set role anon');for(const table of ['runs','segments','placements'])await assert.rejects(f.db.query('select * from journal.'+table),/permission denied/);await assert.rejects(f.db.query('select journal.snapshot_v2($1)',[DIARY_ID]),/permission denied/);
}finally{await f.db.close();}});
test('Seoul midnight is split without double counting; manual input and API reject out-of-range interruptions',()=>{
 assert.deepEqual(weekDays('2026-09-18'),['2026-09-13','2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19']);assert.equal(localInstant('2026-09-18','00:00'),'2026-09-17T15:00:00.000Z');
 const start='2026-09-18T14:30:00.000Z',end='2026-09-18T15:30:00.000Z',segments=manualSegments(start,end,[]);
 const run={segments:segments.map((s,i)=>({id:id(i),kind:'work' as const,started_at:s.startedAt,ended_at:s.endedAt}))} as Parameters<typeof runWork>[0];
 const a=dayWindow('2026-09-18'),b=dayWindow('2026-09-19');assert.equal(runWork(run,a.from,a.to),1800000);assert.equal(runWork(run,b.from,b.to),1800000);
 assert.throws(()=>manualSegments(start,end,[{kind:'break',start,end:'2026-09-18T16:00:00Z'}]));assert.throws(()=>localInstant('2026-09-18','24:00'));
 assert.throws(()=>parseCommand({requestId:id(1),expectedRevision:0,command:'create_run',payload:{taskId:id(2),startedAt:start,endedAt:end,segments:[{kind:'break',startedAt:start,endedAt:'2026-09-18T16:00:00Z'}]}}));
});
