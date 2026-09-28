'use client';
import {useRef} from 'react';
import type {Plan,Snapshot} from '@/lib/contracts';
import {planCompletion,planWeekSegments,plansOnDay,tasksInPlan} from '@/lib/calendar-plans';
import {monthEntriesForDay} from '@/lib/month-preview';
import {addDays} from '@/lib/schedule';
import {dateText,priorityText} from './presentation';

const weekdays=['일','월','화','수','목','금','토'];
const palette=['warm','gold','mint','blue','violet'];
function colorFor(plan:Plan){let code=0;for(const char of plan.id)code=(code*31+char.charCodeAt(0))%palette.length;return palette[code];}
function column(day:string,weekStart:string){return Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(weekStart+'T12:00:00Z'))/86400000);}

export function Monthly({data,day,today,selectDay,openDay}:{data:Snapshot;day:string;today:string;selectDay:(d:string)=>void;openDay:(d:string,id?:string)=>void}){
 const detail=useRef<HTMLElement>(null),first=day.slice(0,7)+'-01',lead=new Date(first+'T12:00:00Z').getUTCDay(),count=new Date(Date.UTC(Number(day.slice(0,4)),Number(day.slice(5,7)),0)).getUTCDate(),weeks=Math.ceil((lead+count)/7),monthLast=day.slice(0,7)+'-'+String(count).padStart(2,'0');
 const firstVisible=addDays(first,-lead),plans=data.plans.filter(p=>p.start_date&&p.end_date&&p.start_date<=monthLast&&p.end_date>=first).sort((a,b)=>a.start_date!.localeCompare(b.start_date!)||a.title.localeCompare(b.title,'ko')||a.id.localeCompare(b.id));
 const related=plansOnDay(data,day),relatedIds=new Set(related.map(p=>p.id)),other=monthEntriesForDay(data,day).filter(item=>!relatedIds.has(item.task.plan_id));
 function select(d:string){selectDay(d);detail.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 return <><p className="small muted">형광펜은 계획한 기간입니다. 실제 작업 날짜와 시간은 일간에서 확인할 수 있습니다.</p><div className="month-calendar" aria-label={dateText(first)+'부터 '+dateText(monthLast)+'까지의 계획 달력'}>
  <div className="month-weekdays" aria-hidden="true">{weekdays.map(d=><span key={d}>{d}</span>)}</div>
  {Array.from({length:weeks},(_,weekIndex)=>{
   const weekStart=addDays(firstVisible,weekIndex*7),weekEnd=addDays(weekStart,6),segments=planWeekSegments(plans,weekStart,weekEnd,first,monthLast);
   return <div className="month-week" key={weekStart} style={{minHeight:Math.max(98,48+segments.length*31)+'px'}}>
    {Array.from({length:7},(_,col)=>{const d=addDays(weekStart,col),inMonth=d>=first&&d<=monthLast,dayPlans=inMonth?plansOnDay(data,d):[];return inMonth?<button type="button" className={'month-date-button'+(d===today?' current':'')+(d===day?' selected-date':'')} key={d} aria-pressed={d===day} aria-label={dateText(d,true)+(dayPlans.length?' · 계획 '+dayPlans.map(p=>p.title).join(', '):' · 계획 없음')} onClick={()=>select(d)}><span className="date-number" data-typo-role="number">{Number(d.slice(8))}</span>{d===today&&<span className="month-today">오늘</span>}</button>:<span className="month-empty-date" key={d} aria-hidden="true"/>;})}
    {segments.map(({plan,start,end,label},lane)=>{const startColumn=column(start,weekStart),length=column(end,weekStart)-startColumn+1;
     return <span className={'month-plan-band marker-'+colorFor(plan)} key={plan.id} aria-hidden="true" style={{left:`calc(${startColumn/7*100}% + 3px)`,width:`calc(${length/7*100}% - 6px)`,top:39+lane*31+'px'}}>{label&&<span>{plan.title}</span>}</span>;
    })}
   </div>;
  })}
 </div>
 <section ref={detail} className="month-detail" tabIndex={-1} aria-label="선택 날짜의 계획과 할 일"><div className="row spread"><h2 data-typo-role="title">{dateText(day,true)}의 계획</h2><button className="link" onClick={()=>openDay(day)}>일간 상세 →</button></div><p className="small muted">계획 기간에 포함된 할 일을 모두 보여줍니다. 완료율은 현재 상태이며, 계획 기간은 매일 실행했다는 뜻이 아닙니다.</p>
  {related.map(plan=>{const tasks=tasksInPlan(data,plan,day),count=planCompletion(data,plan,day);return <details className="month-plan-detail" key={plan.id}><summary><span className="month-plan-title" data-typo-role="title">{plan.title}</span><span className="month-plan-count">{plan.kind==='routine'?(count.total?'루틴 · '+count.done+'/'+count.total+' 완료':'루틴 · 이날 할 일 없음'):count.done+'/'+count.total+' 완료 · 현재 완료율 '+count.percent+'%'}</span></summary><ul>{tasks.map(task=><li key={task.id}><button className="month-task-link" onClick={()=>openDay(day,task.id)} aria-label={task.title+' 일간 상세'}><span className={'month-task-title'+(task.complete?' done':'')} data-typo-role="title">{task.priority==='high'&&<i className="month-priority-dot" aria-hidden="true"/>}{task.title}</span><small>{task.complete?'완료 · ':''}우선순위 {priorityText(task.priority)}{task.due_date?' · 마감 '+dateText(task.due_date):''}</small></button></li>)}{!tasks.length&&<li className="small muted">이 날짜에 표시할 할 일이 없습니다.</li>}</ul></details>;})}
  {!!other.length&&<details className="month-plan-detail"><summary><span className="month-plan-title" data-typo-role="title">그 밖의 일정</span><span className="month-plan-count">배치 또는 이날 마감 · {other.length}개</span></summary><ul>{other.map(({task})=><li key={task.id}><button className="month-task-link" onClick={()=>openDay(day,task.id)}><span className={'month-task-title'+(task.complete?' done':'')} data-typo-role="title">{task.title}</span><small>{task.complete?'완료 · ':''}우선순위 {priorityText(task.priority)}</small></button></li>)}</ul></details>}
  {!related.length&&!other.length&&<p className="empty">이 날짜에 진행 기간이 걸친 계획이나 배치·마감 일정이 없습니다.</p>}
 </section></>;
}
