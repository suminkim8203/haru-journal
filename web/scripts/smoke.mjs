// Production HTTP checks; no commands or persistent test records are sent.
import {spawn} from 'node:child_process';import {once} from 'node:events';import net from 'node:net';import assert from 'node:assert/strict';
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],windowsHide:true});
app.stdout.resume();app.stderr.resume();const base='http://127.0.0.1:'+port;
try{let ready=false;for(let n=0;n<60;n++){if(app.exitCode!==null)throw Error('App stopped before readiness');try{const response=await fetch(base,{signal:AbortSignal.timeout(500)});if(response.ok){const html=await response.text();assert.ok(html.includes('HaruLeaf'));assert.ok(html.includes('지금은 로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다.'));ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
for(const endpoint of ['/api/diary','/api/commands','/api/export'])assert.equal((await fetch(base+endpoint)).status,404);
console.log('PASS production HTTP: public notice and static app available; retired privileged server APIs absent.');
}finally{if(app.exitCode===null){const closed=once(app,'close');app.kill();await closed;}}
