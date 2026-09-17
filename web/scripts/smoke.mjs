import {spawn} from 'node:child_process';
import net from 'node:net';
import assert from 'node:assert/strict';
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,SUPABASE_URL:'',SUPABASE_SECRET_KEY:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';app.stdout.on('data',b=>logs+=b);app.stderr.on('data',b=>logs+=b);
const base=`http://127.0.0.1:${port}`;
try{
 let ready=false;for(let n=0;n<60;n++){if(app.exitCode!==null)throw Error('Application exited before readiness: '+logs);try{const r=await fetch(base,{signal:AbortSignal.timeout(500)});if(r.ok){const html=await r.text();assert.ok(html.includes('저장소 연결을 준비하고 있습니다.'));ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'server starts');
 let r=await fetch(base+'/api/diary');assert.equal(r.status,503);assert.equal((await r.json()).error.code,'NOT_CONFIGURED');
 r=await fetch(base+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:'invalid'});assert.equal(r.status,400);
 r=await fetch(base+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:'{}'});assert.equal(r.status,403);
 r=await fetch(base+'/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:0,command:'create_plan',payload:{kind:'general',title:'연결 전',startDate:'2026-09-17',endDate:'2026-09-18'}})});assert.equal(r.status,503);assert.equal((await r.json()).error.code,'NOT_CONFIGURED');
 console.log('PASS HTTP: app starts, unconfigured state, invalid JSON, origin rejection, no false save success');
}finally{app.kill();}
