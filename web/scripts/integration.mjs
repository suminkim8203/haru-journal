// Supabase SDK -> local HTTP RPC adapter -> SQL as anon. Not real NAS evidence.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;');
for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
await db.exec('set role anon');
const key='local-public-fixture-'+randomUUID();
const server=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');try{
 assert.equal(req.headers.apikey,key);let text='';for await(const chunk of req)text+=chunk;const p=JSON.parse(text||'{}');let v;
 if(req.url==='/rest/v1/rpc/haru_snapshot')v=(await db.query('select public.haru_snapshot() v')).rows[0].v;
 else if(req.url==='/rest/v1/rpc/haru_export')v=(await db.query('select public.haru_export() v')).rows[0].v;
 else if(req.url==='/rest/v1/rpc/haru_command')v=(await db.query('select public.haru_command($1,$2,$3,$4::jsonb) v',[p.p_request_id,p.p_expected_revision,p.p_command,JSON.stringify(p.p_payload)])).rows[0].v;
 else{res.statusCode=404;res.end('{}');return;}res.end(JSON.stringify(v));
 }catch(e){res.statusCode=e.code==='P0001'?409:400;res.end(JSON.stringify({code:e.code||'22023',message:'Test SQL rejected request'}));}});
try{
 server.listen(0,'127.0.0.1');await once(server,'listening');const client=createClient('http://127.0.0.1:'+server.address().port,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const send=async(c,p,rev,id=randomUUID())=>client.rpc('haru_command',{p_request_id:id,p_expected_revision:rev,p_command:c,p_payload:p});
 const requestId=randomUUID(),payload={kind:'general',title:'<script>window.fixture=1</script>',startDate:'2026-09-18',endDate:'2026-09-30',priority:'high',estimatedMinutes:120};
 const first=await send('create_plan',payload,0,requestId);assert.equal(first.error,null);assert.deepEqual((await send('create_plan',payload,0,requestId)).data,first.data);
 const task=await send('create_task',{planId:first.data.entityId,title:'SDK 직접 저장 검증',estimatedMinutes:30,tags:['독서',' 독서 ']},1);assert.equal(task.error,null);
 assert.equal((await send('update_task',{taskId:task.data.entityId,title:'잘못된 입력',estimatedMinutes:'30'},2)).error.code,'22023');
 assert.equal((await send('create_plan',payload,0)).error.code,'P0001');
 assert.equal((await send('start_run',{taskId:task.data.entityId,at:'2026-09-18T00:00:00.000Z'},2)).error,null);
 const done={taskId:task.data.entityId,complete:true,at:'2026-09-18T00:30:00.000Z'},doneId=randomUUID();const completed=await send('set_task_complete',done,3,doneId);assert.equal(completed.error,null);assert.deepEqual((await send('set_task_complete',done,3,doneId)).data,completed.data);
 const saved=await client.rpc('haru_snapshot');assert.equal(saved.error,null);assert.equal(saved.data.tasks[0].tags.length,1);assert.equal(saved.data.tasks[0].complete,true);assert.equal(saved.data.runs[0].work_seconds,1800);
 const reloaded=await createClient('http://127.0.0.1:'+server.address().port,key,{auth:{persistSession:false,autoRefreshToken:false}}).rpc('haru_snapshot');assert.deepEqual(reloaded.data,saved.data);
 const thought=await send('save_thought',{taskId:task.data.entityId,date:'2026-09-18',body:'단상'},4);assert.equal(thought.error,null);assert.equal((await send('save_reflection',{date:'2026-09-18',body:'회고',imports:[{id:thought.data.entityId,body:'단상'}]},5)).error,null);
 const exported=await client.rpc('haru_export');assert.equal(exported.error,null);assert.equal(exported.data.reflections.length,1);assert.equal(exported.data.runs.length,1);assert.equal('command_receipts' in exported.data,false);assert.equal(JSON.stringify(exported.data).includes(key),false);
 console.log('PASS direct Supabase SDK transport: anonymous restricted RPC, reload, idempotency, conflict, SQL validation, atomic completion, thought/reflection and full export. Temporary local DB only.');
}finally{await new Promise(resolve=>server.close(resolve));await db.close();}
