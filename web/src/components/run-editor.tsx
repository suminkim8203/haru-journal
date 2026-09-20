'use client';
import {useState} from 'react';
import type {Placement,Run,Task} from '@/lib/contracts';
import {addDays,clockLabel,localInstant,manualSegments,seoulDate} from '@/lib/schedule';
import {useJournal} from './journal-provider';
import {DateField} from './date-field';
import {TimeField} from './time-field';
export function RunEditor({task,day,mode,run,placement,startAt,onClose}:{task:Task;day:string;mode:'placement'|'run';run?:Run;placement?:Placement;startAt?:string;onClose:()=>void}){
 const initial=run||placement||(startAt?{started_at:startAt,ended_at:new Date(Date.parse(startAt)+Math.max(1,task.estimated_minutes)*60000).toISOString()}:undefined); const {data,locked,send}=useJournal();const [date,setDate]=useState(initial?seoulDate(new Date(initial.started_at)):day),[endDate,setEndDate]=useState(initial?.ended_at?seoulDate(new Date(initial.ended_at)):day);
 const [start,setStart]=useState(initial?clockLabel(initial.started_at):'09:00'),[end,setEnd]=useState(initial?.ended_at?clockLabel(initial.ended_at):'10:00'),[reason,setReason]=useState(run?.blocked_reason||''),[error,setError]=useState(''),[allowOverlap,setAllowOverlap]=useState(false);
 const [pauses,setPauses]=useState((run?.segments.filter(s=>s.kind!=='work'&&s.ended_at).map(s=>({kind:s.kind==='break'?'break' as const:'interrupt' as const,start:clockLabel(s.started_at),end:clockLabel(s.ended_at!),startDate:seoulDate(new Date(s.started_at)),endDate:seoulDate(new Date(s.ended_at!))}))||[]));
 function quickEnd(n:number){try{const value=new Date(Date.parse(localInstant(date,start))+n*60000);setEndDate(seoulDate(value));setEnd(clockLabel(+value));}catch{setError('시작 시간을 먼저 입력해 주세요.');}}
 return <form className="editor" onSubmit={async e=>{e.preventDefault();setError('');try{
  const startedAt=localInstant(date,start),endedAt=localInstant(endDate,end);if(Date.parse(endedAt)<=Date.parse(startedAt))throw Error('종료 시각은 시작 시각 이후여야 합니다. 다음 날 종료라면 종료일을 변경해 주세요.');
  const payload={allowOverlap,taskId:task.id,startedAt,endedAt,...(mode==='run'?{blockedReason:reason,segments:manualSegments(startedAt,endedAt,pauses.map(p=>({kind:p.kind,start:localInstant(p.startDate,p.start),end:localInstant(p.endDate,p.end)})))}:{})};
  if(mode==='placement'&&!allowOverlap&&data?.placements.some(p=>p.id!==placement?.id&&Date.parse(p.started_at)<Date.parse(endedAt)&&Date.parse(p.ended_at)>Date.parse(startedAt)))throw Error('예정 시간이 기존 배치와 겹칩니다. 시간을 바꾸거나 겹침 확인을 선택해 주세요.');
  const result=await send(mode==='placement'?(placement?'update_placement':'create_placement'):run?'update_run':'create_run',{...payload,...(run?{runId:run.id}:{}),...(placement?{placementId:placement.id}:{})});if(result)onClose();
 }catch(e){setError(e instanceof Error?e.message:'시간을 확인해 주세요.');}}}>
  <div className="editor-head"><h2 data-typo-role="title">{mode==='placement'?(placement?'계획 배치 수정':'계획 배치'):run?'실행 기록 수정':'실행 기록 입력'}</h2><button type="button" className="link" aria-label="입력 닫기" onClick={onClose}>×</button></div><p className="task-title" data-typo-role="title">{task.title}</p><fieldset disabled={locked}>
  <div className="form-grid"><DateField label="시작일" required value={date} onChange={setDate}/><TimeField label="시작 시간" value={start} onChange={setStart}/><DateField label="종료일" required value={endDate} onChange={setEndDate}/><TimeField label="종료 시간" value={end} onChange={setEnd}/></div>
  <div className="quick-times"><span>종료 시간</span>{[5,10,15].map(n=><button type="button" key={n} onClick={()=>quickEnd(n)}>+{n}분</button>)}<button type="button" onClick={()=>setEndDate(addDays(date,1))}>다음 날</button></div>
  {mode==='placement'&&<label className="complete-control"><input type="checkbox" checked={allowOverlap} onChange={e=>setAllowOverlap(e.target.checked)}/>예정 시간이 겹치는 것을 확인했으며 그대로 배치</label>}
  {mode==='run'&&<><div className="section-heading"><span>휴식·중단</span><button type="button" disabled={pauses.length>=50} onClick={()=>setPauses([...pauses,{kind:'break',start,end,startDate:date,endDate}])}>구간 추가</button></div>
  <p className="form-help">기록한 시작·종료 사이의 시간만 저장됩니다. 시간이 벗어나면 값을 유지하고 오류를 알려드립니다.</p>
  {pauses.map((p,i)=><div className="pause-editor" key={i}><label className="field"><span>유형</span><select value={p.kind} onChange={e=>setPauses(pauses.map((v,j)=>j===i?{...v,kind:e.target.value as 'break'|'interrupt'}:v))}><option value="break">휴식</option><option value="interrupt">중단</option></select></label>
   <DateField label="구간 시작일" min={date} max={endDate} required value={p.startDate} onChange={value=>setPauses(pauses.map((v,j)=>j===i?{...v,startDate:value}:v))}/><TimeField min={p.startDate===date?start:undefined} max={p.startDate===endDate?end:undefined} label="구간 시작" value={p.start} onChange={value=>setPauses(pauses.map((v,j)=>j===i?{...v,start:value}:v))}/>
   <DateField label="구간 종료일" min={date} max={endDate} required value={p.endDate} onChange={value=>setPauses(pauses.map((v,j)=>j===i?{...v,endDate:value}:v))}/><TimeField min={p.endDate===date?start:undefined} max={p.endDate===endDate?end:undefined} label="구간 종료" value={p.end} onChange={value=>setPauses(pauses.map((v,j)=>j===i?{...v,end:value}:v))}/><button type="button" className="link" onClick={()=>setPauses(pauses.filter((_,j)=>j!==i))}>제거</button></div>)}
  <label className="field"><span>막힌 이유 · 선택</span><textarea data-typo-role="record-input" maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="실행 중 막힌 이유가 있었다면 남겨 주세요."/></label></>}
  {error&&<p role="alert">{error}</p>}<div className="form-actions"><button className="btn primary" type="submit">{locked?'저장 중…':mode==='placement'?'배치 저장':'실행 기록 저장'}</button></div></fieldset>
 </form>;
}
