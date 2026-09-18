'use client';
import {useEffect,useRef,useState} from 'react';
import {runWork} from '@/lib/schedule';
import {useJournal} from './journal-provider';
export function RecordingPanel({now,onOpen}:{now:number;onOpen:(taskId:string)=>void}){
 const {data,locked,send}=useJournal(),run=data?.runs.find(r=>!r.ended_at),task=data?.tasks.find(t=>t.id===run?.task_id);
 const [position,setPosition]=useState<{x:number;y:number}|null>(null),[stop,setStop]=useState(false),[reason,setReason]=useState('');
 const drag=useRef<{x:number;y:number;startX:number;startY:number}|null>(null);
 function clamp(value:{x:number;y:number}){return {x:Math.max(8,Math.min(window.innerWidth-308,value.x)),y:Math.max(8,Math.min(window.innerHeight-96,value.y))};}
 function persist(value:{x:number;y:number}){try{localStorage.setItem('haru-recording-position',JSON.stringify(value));}catch{}}
 useEffect(()=>{const resize=()=>setPosition(v=>v?clamp(v):null);try{const saved=JSON.parse(localStorage.getItem('haru-recording-position')||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))setPosition(clamp(saved));}catch{}window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 if(!run||!task)return null;
 const current=run.segments.at(-1)?.kind,minutes=Math.floor(runWork(run,-8640000000000000,8640000000000000,now)/60000);
 return <><aside className="recording-panel" aria-label="현재 기록" style={position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:{}}>
 <div className="recording-top"><button className="drag-handle" aria-label="기록 표시 이동 · 방향키로도 이동" onKeyDown={e=>{const vector:{[key:string]:[number,number]}={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};const v=vector[e.key];if(!v)return;e.preventDefault();const rect=e.currentTarget.closest('aside')!.getBoundingClientRect(),p=clamp({x:rect.x+v[0],y:rect.y+v[1]});setPosition(p);persist(p);}}
 onPointerDown={e=>{const rect=e.currentTarget.closest('aside')!.getBoundingClientRect();drag.current={x:rect.x,y:rect.y,startX:e.clientX,startY:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const d=drag.current;if(d)setPosition(clamp({x:d.x+e.clientX-d.startX,y:d.y+e.clientY-d.startY}));}}
 onPointerUp={e=>{drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId);const rect=e.currentTarget.closest('aside')!.getBoundingClientRect();persist(clamp({x:rect.x,y:rect.y}));}}
 onPointerCancel={()=>{drag.current=null;}}>⠿</button><span>{current==='work'?'기록 중':current==='break'?'휴식 중':'중단 중'} · {minutes}분</span><button className="text-button" onClick={()=>onOpen(task.id)}>기록으로 →</button></div>
 <div className="recording-bottom"><strong className="task-title" title={task.title}>{task.title}</strong><button className="icon-button" disabled={locked} aria-label={current==='work'?'기록 일시 중단':'기록 재개'} onClick={()=>void send('switch_segment',{runId:run.id,kind:current==='work'?'pause':'work',at:new Date().toISOString()})}>{current==='work'?'⏸':'▶'}</button><button className="icon-button" disabled={locked} aria-label="기록 종료" onClick={()=>{setReason(run.blocked_reason);setStop(true);}}>⏹</button></div></aside>
 {stop&&<div className="modal-backdrop"><section className="stop-dialog" role="dialog" aria-modal="true" aria-labelledby="stop-title"><div className="section-heading"><h3 id="stop-title">기록 종료</h3><button className="text-button" aria-label="닫기" onClick={()=>setStop(false)}>×</button></div><label>막힌 이유 · 선택<textarea className="record-input" maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><p className="field-help">종료해도 할 일의 완료 상태는 바뀌지 않습니다.</p><div className="actions"><button className="primary" disabled={locked} onClick={async()=>{const result=await send('stop_run',{runId:run.id,at:new Date().toISOString(),blockedReason:reason});if(result)setStop(false);}}>기록 종료</button></div></section></div>}
 </>;
}
