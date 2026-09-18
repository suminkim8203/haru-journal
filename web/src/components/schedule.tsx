'use client';
import {useEffect,useRef,useState} from 'react';
import {addDays,clockLabel,dayItems,dayWindow,overlaps,runWork,weekDays} from '@/lib/schedule';
import type {Task} from '@/lib/contracts';
import {useJournal} from './journal-provider';
import {DateField} from './date-field';
import {ThoughtEditor,DayClosing} from './records';
import {RunEditor} from './run-editor';
const priority=(value:string)=>({high:'높음',normal:'보통',low:'낮음'})[value as 'high'];
export function Schedule({day,setDay,selectedId,setSelectedId,now,openRequest}:{day:string;setDay:(v:string)=>void;selectedId:string;setSelectedId:(v:string)=>void;now:number;openRequest:number}){
 const {data,locked,blocked,send}=useJournal();const [view,setView]=useState<'daily'|'weekly'|'monthly'>('daily'),[expanded,setExpanded]=useState('');
 const [editor,setEditor]=useState<{task:Task;mode:'placement'|'run';runId?:string}|null>(null);const detail=useRef<HTMLElement>(null);
 useEffect(()=>{setView('daily');},[openRequest]);
 const selected=data?.tasks.find(t=>t.id===selectedId),items=data?dayItems(data,day,now):null;
 function choose(id:string){setSelectedId(id);requestAnimationFrame(()=>detail.current?.scrollIntoView({behavior:'smooth',block:'start'}));}
 function openDay(value:string,id?:string){setDay(value);setView('daily');if(id)setSelectedId(id);}
 const live=data?.runs.find(r=>!r.ended_at);
 const days=weekDays(day),from=dayWindow(day).from;
 return <>
 <div className="page-title"><div><small>DO</small><h2> 일정</h2></div></div>
 <nav className="view-tabs" aria-label="일정 보기">{([['daily','일간'],['weekly','주간'],['monthly','월간']] as const).map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</nav>
 <div className="schedule-date"><button className="text-button" aria-label="이전 날짜" onClick={()=>setDay(addDays(day,view==='weekly'?-7:-1))}>‹</button><DateField label="날짜 선택" required value={day} onChange={setDay}/><button className="text-button" aria-label="다음 날짜" onClick={()=>setDay(addDays(day,view==='weekly'?7:1))}>›</button><button className="primary" onClick={()=>setDay(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(now)))}>{view==='monthly'?'이번 달':'오늘'}</button></div>
 {!data&&<p className="empty">저장소 연결 후 일정을 확인할 수 있습니다.</p>}
 {data&&view==='daily'&&<>
 <div className="day-strip">{days.map(d=><button key={d} aria-pressed={d===day} onClick={()=>setDay(d)}><span className="day-name">{['일','월','화','수','목','금','토'][new Date(d+'T00:00:00Z').getUTCDay()]}</span><span>{Number(d.slice(8))}</span></button>)}</div>
 <div className="daily-layout"><section className="day-task-list"><h3>할 일</h3>{items?.tasks.map(t=><article className="daily-task" key={t.id}><input type="checkbox" checked={t.complete} disabled={blocked} aria-label={t.title+' 완료'} onChange={e=>void send('set_task_complete',{taskId:t.id,complete:e.target.checked})}/><button className="text-button task-title" onClick={()=>choose(t.id)}>{t.title}</button></article>)}{!items?.tasks.length&&<p className="field-help">이 날짜에 배치되거나 기록된 할 일이 없습니다.</p>}
 <label>할 일 선택<select value={selectedId} onChange={e=>choose(e.target.value)}><option value="">선택하세요</option>{data.tasks.map(t=><option key={t.id} value={t.id}>{t.title}{t.complete?' · 완료':''}</option>)}</select></label></section>
 <section className="timeline-section"><h3>시간 흐름</h3><p className="field-help">예정과 실제는 따로 기록됩니다.</p><div className="timeline">
 {Array.from({length:24},(_,h)=><div className="hour-rule" key={h} style={{top:h*40}}><span>{String(h).padStart(2,'0')}:00</span></div>)}
 {items?.placements.map(p=><button className="time-block planned" key={p.id} style={{top:Math.max(0,(Date.parse(p.started_at)-from)/3600000*40),height:Math.max(24,(Math.min(from+86400000,Date.parse(p.ended_at))-Math.max(from,Date.parse(p.started_at)))/3600000*40)}} onClick={()=>choose(p.task_id)}><span>예정 · {clockLabel(p.started_at)}</span><strong>{data.tasks.find(t=>t.id===p.task_id)?.title}</strong></button>)}
 {items?.runs.flatMap(r=>r.segments.filter(s=>overlaps(s.started_at,s.ended_at,day,now)).map(s=><button key={s.id} className={'time-block actual '+s.kind} style={{top:Math.max(0,(Date.parse(s.started_at)-from)/3600000*40),height:Math.max(24,(Math.min(from+86400000,s.ended_at?Date.parse(s.ended_at):now)-Math.max(from,Date.parse(s.started_at)))/3600000*40)}} onClick={()=>choose(r.task_id)}><span>{s.kind==='work'?'실제':s.kind==='break'?'휴식':'중단'} · {clockLabel(s.started_at)}</span><strong>{data.tasks.find(t=>t.id===r.task_id)?.title}</strong></button>))}
 {now>=from&&now<from+86400000&&<div className="now-line" style={{top:(now-from)/3600000*40}}><span>{clockLabel(now)}</span></div>}
 </div></section></div>
 {selected&&<section ref={detail} className="task-detail" key={selected.id+day}><div className="section-heading"><h3 className="task-title">{selected.title}</h3><label className="complete-control"><input type="checkbox" checked={selected.complete} disabled={blocked} onChange={e=>void send('set_task_complete',{taskId:selected.id,complete:e.target.checked})}/>할 일 완료</label></div>
 <p className="field-help">예상 {selected.estimated_minutes}분 · 우선순위 {priority(selected.priority)} · {selected.due_date||'마감일 없음'}</p>
 <div className="record-actions"><button className="primary record-start" disabled={locked||selected.complete||!!live} onClick={()=>void send('start_run',{taskId:selected.id,at:new Date().toISOString()})}>기록 시작</button><div className="side-actions"><button className="text-button" disabled={locked||selected.complete} onClick={()=>setEditor({task:selected,mode:'placement'})}>계획 배치</button><button className="text-button" disabled={locked} onClick={()=>setEditor({task:selected,mode:'run'})}>실행 기록 입력</button></div></div>
 {selected.complete&&<p className="field-help">완료한 할 일은 수기 실행 기록을 추가할 수 있습니다. 다시 기록을 시작하려면 완료를 해제해 주세요.</p>}
 {live?.task_id===selected.id&&<div className="live-controls"><span>기록 유형</span>{(['work','break','interrupt'] as const).map(kind=><button key={kind} disabled={locked||live.segments.at(-1)?.kind===kind} onClick={()=>void send('switch_segment',{runId:live.id,kind,at:new Date().toISOString()})}>{kind==='work'?'작업':kind==='break'?'휴식':'중단'}</button>)}</div>}
 <details><summary>예정 시간</summary>{data.placements.filter(p=>p.task_id===selected.id&&overlaps(p.started_at,p.ended_at,day,now)).map(p=><p key={p.id}>{clockLabel(p.started_at)}–{clockLabel(p.ended_at)}</p>)}</details>
 {selected.description&&<details><summary>설명</summary><p className="record-body">{selected.description}</p></details>}
 {data.runs.some(r=>r.task_id===selected.id&&r.segments.some(s=>s.kind==='work'&&overlaps(s.started_at,s.ended_at,day,now)))&&<ThoughtEditor task={selected} day={day}/>}
 <details><summary>실행 기록</summary>{data.runs.filter(r=>r.task_id===selected.id&&overlaps(r.started_at,r.ended_at,day,now)).map(r=><article className="run-row" key={r.id}><p>{clockLabel(r.started_at)}–{r.ended_at?clockLabel(r.ended_at):'기록 중'} · 작업 {Math.floor(runWork(r,-8640000000000000,8640000000000000,now)/60000)}분</p>{r.blocked_reason&&<p className="record-body">막힌 이유: {r.blocked_reason}</p>}{r.ended_at&&<button className="text-button" disabled={locked} onClick={()=>setEditor({task:selected,mode:'run',runId:r.id})}>수정</button>}</article>)}</details>
 </section>}
 <DayClosing key={day} day={day}/>
 </>}
 {data&&view==='weekly'&&<><h3 className="date-range">{days[0].slice(5).replace('-','.')}–{days[6].slice(5).replace('-','.')}</h3><p className="field-help">예정 · 실제 · 마감을 나누어 확인합니다. 각 영역은 처음 세 항목을 보여줍니다.</p><div className="week-grid">{days.map(d=>{
 const value=dayItems(data,d,now),limit=expanded===d?Infinity:3;
 const lists=[{name:'예정',items:value.placements.map(p=>({id:p.id,task:data.tasks.find(t=>t.id===p.task_id),text:`${clockLabel(p.started_at)}–${clockLabel(p.ended_at)}`}))},{name:'실제',items:value.runs.map(r=>({id:r.id,task:data.tasks.find(t=>t.id===r.task_id),text:`${clockLabel(r.started_at)}–${r.ended_at?clockLabel(r.ended_at):'기록 중'} · 작업 ${Math.floor(runWork(r,-8640000000000000,8640000000000000,now)/60000)}분`}))},{name:'마감',items:data.tasks.filter(t=>t.due_date===d).map(t=>({id:t.id,task:t,text:t.complete?'완료':'미완료'}))}];
 return <section key={d}><button className="text-button week-date" onClick={()=>openDay(d)}><span className="day-name">{['일','월','화','수','목','금','토'][new Date(d+'T00:00:00Z').getUTCDay()]}</span> {Number(d.slice(8))}</button>{lists.map(list=><div className={'week-section '+(list.name==='실제'?'actual-section':'')} key={list.name}><h4>{list.name}</h4><ul>{list.items.slice(0,limit).map(item=><li key={item.id}><button className="text-button" onClick={()=>openDay(d,item.task?.id)}><strong className="task-title">{item.task?.title}</strong><span>{item.text} · 우선순위 {priority(item.task?.priority||'normal')}</span></button></li>)}</ul>{!list.items.length&&<p className="field-help">없음</p>}{list.items.length>limit&&<p className="field-help">외 {list.items.length-limit}건</p>}</div>)}{lists.some(l=>l.items.length>3)&&<button className="text-button" onClick={()=>setExpanded(expanded===d?'':d)}>{expanded===d?'접기':'더 보기'}</button>}</section>;
 })}</div></>}
 {data&&view==='monthly'&&<><h3>{Number(day.slice(0,4))}년 {Number(day.slice(5,7))}월</h3><div className="month-grid">{['일','월','화','수','목','금','토'].map(d=><span className="day-name" key={d}>{d}</span>)}{Array.from({length:new Date(day.slice(0,7)+'-01T00:00:00Z').getUTCDay()},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:new Date(Number(day.slice(0,4)),Number(day.slice(5,7)),0).getDate()},(_,i)=>{const date=day.slice(0,7)+'-'+String(i+1).padStart(2,'0'),v=dayItems(data,date,now);return <button key={date} aria-pressed={date===day} onClick={()=>openDay(date)}><span>{i+1}</span><small>예정 {v.placements.length} · 기록 {v.runs.length}<br/>마감 {data.tasks.filter(t=>t.due_date===date).length}</small></button>;})}</div></>}
 {editor&&<RunEditor key={editor.runId||editor.task.id+editor.mode} task={editor.task} day={day} mode={editor.mode} run={data?.runs.find(r=>r.id===editor.runId)} onClose={()=>setEditor(null)}/>}
 </>;
}
