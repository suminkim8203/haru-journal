'use client';
import {useState} from 'react';
import type {Placement,Run,Task} from '@/lib/contracts';
import {addDays,clockLabel,localInstant,manualRunSegments,seoulDate} from '@/lib/schedule';
import {useJournal} from './journal-provider';
import {DateField} from './date-field';
import {TimeField} from './time-field';
export function RunEditor({task,day,mode,run,placement,startAt,onClose}:{task:Task;day:string;mode:'placement'|'run';run?:Run;placement?:Placement;startAt?:string;onClose:()=>void}){
 const initial=run||placement||(startAt?{started_at:startAt,ended_at:new Date(Date.parse(startAt)+Math.max(1,task.estimated_minutes)*60000).toISOString()}:undefined); const {data,locked,send,saveError}=useJournal();const [date,setDate]=useState(initial?seoulDate(new Date(initial.started_at)):day),[endDate,setEndDate]=useState(initial?.ended_at?seoulDate(new Date(initial.ended_at)):day);
 const [start,setStart]=useState(initial?clockLabel(initial.started_at):'09:00'),[end,setEnd]=useState(initial?.ended_at?clockLabel(initial.ended_at):'10:00'),[reason,setReason]=useState(run?.blocked_reason||''),[error,setError]=useState(''),[allowOverlap,setAllowOverlap]=useState(false);
 const [submitted,setSubmitted]=useState(false);
 function quickEnd(n:number){try{const value=new Date(Date.parse(localInstant(date,start))+n*60000);setEndDate(seoulDate(value));setEnd(clockLabel(+value));}catch{setError('시작 시간을 먼저 입력해 주세요.');}}
 return <form className="editor" onSubmit={async e=>{e.preventDefault();setSubmitted(true);setError('');try{
  const startedAt=run&&date===seoulDate(new Date(run.started_at))&&start===clockLabel(run.started_at)?new Date(run.started_at).toISOString():localInstant(date,start),endedAt=run?.ended_at&&endDate===seoulDate(new Date(run.ended_at))&&end===clockLabel(run.ended_at)?new Date(run.ended_at).toISOString():localInstant(endDate,end);if(Date.parse(endedAt)<=Date.parse(startedAt))throw Error('종료 시각은 시작 시각 이후여야 합니다. 다음 날 종료라면 종료일을 변경해 주세요.');
  const payload={allowOverlap,taskId:task.id,startedAt,endedAt,...(mode==='run'?{blockedReason:reason,segments:manualRunSegments(startedAt,endedAt,run)}:{})};
  if(mode==='placement'&&!allowOverlap&&data?.placements.some(p=>p.id!==placement?.id&&Date.parse(p.started_at)<Date.parse(endedAt)&&Date.parse(p.ended_at)>Date.parse(startedAt)))throw Error('예정 시간이 기존 배치와 겹칩니다. 시간을 바꾸거나 겹침 확인을 선택해 주세요.');
  if(mode==='run'&&data?.runs.some(r=>r.id!==run?.id&&Date.parse(r.started_at)<Date.parse(endedAt)&&(!r.ended_at||Date.parse(r.ended_at)>Date.parse(startedAt))))throw Error('이미 저장된 실행 기록 또는 진행 중인 타이머와 시간이 겹칩니다. 겹치지 않는 시간으로 입력해 주세요.');
  const result=await send(mode==='placement'?(placement?'update_placement':'create_placement'):run?'update_run':'create_run',{...payload,...(run?{runId:run.id}:{}),...(placement?{placementId:placement.id}:{})});if(result)onClose();
 }catch(e){setError(e instanceof Error?e.message:'시간을 확인해 주세요.');}}}>
  <div className="editor-head"><h2 data-typo-role="title">{mode==='placement'?(placement?'계획 배치 수정':'계획 배치'):run?'실행 기록 수정':'실행 기록 입력'}</h2><button type="button" className="link" aria-label="입력 닫기" onClick={onClose}>×</button></div><p className="task-title" data-typo-role="title">{task.title}</p><fieldset disabled={locked}>
  <div className="form-grid"><DateField label="시작일" required value={date} onChange={setDate}/><TimeField label="시작 시간" value={start} onChange={setStart}/><DateField label="종료일" required value={endDate} onChange={setEndDate}/><TimeField label="종료 시간" value={end} onChange={setEnd}/></div>
  <div className="quick-times"><span>종료 시간</span>{[5,10,15].map(n=><button type="button" key={n} onClick={()=>quickEnd(n)}>+{n}분</button>)}<button type="button" onClick={()=>setEndDate(addDays(date,1))}>다음 날</button></div>
  {mode==='placement'&&<label className="complete-control"><input type="checkbox" checked={allowOverlap} onChange={e=>setAllowOverlap(e.target.checked)}/>예정 시간이 겹치는 것을 확인했으며 그대로 배치</label>}
  {mode==='run'&&<><p className="form-help">실제로 작업한 시간만 입력해 주세요. 쉬었다면 09:00–13:00, 14:00–16:00처럼 나누어 저장합니다. 현재 이후의 시간은 계획 배치를 이용해 주세요.</p>
  {run?.segments.some(s=>s.kind!=='work')&&<div className="form-help"><p>기존 휴식·중단 구간은 그대로 보존됩니다. 수정한 시작·종료 시간에도 이 구간이 포함되어야 합니다.</p><ul>{run.segments.filter(s=>s.kind!=='work').map(s=><li key={s.id}>{s.kind==='break'?'휴식':'중단'} · {clockLabel(s.started_at)}–{s.ended_at?clockLabel(s.ended_at):''}</li>)}</ul></div>}
  <label className="field"><span>막힌 이유 · 선택</span><textarea data-typo-role="record-input" maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="실행 중 막힌 이유가 있었다면 남겨 주세요."/></label></>}
  {(error||(submitted&&saveError))&&<p className="error" role="alert">{error||saveError}</p>}<div className="form-actions"><button className="btn primary" type="submit">{locked?'저장 중…':mode==='placement'?'배치 저장':'실행 기록 저장'}</button></div></fieldset>
 </form>;
}
