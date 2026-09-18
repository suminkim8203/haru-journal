import type {Snapshot,Task} from './contracts.ts';
import {dayWindow,seoulDate,weekDays} from './schedule.ts';
export type Metric='planned'|'complete'|'delayed'|'blocked'|'expected'|'actual'|'difference';
export function planResults(data:Snapshot,planId:string,period:'all'|'week',today=seoulDate()){
 const days=weekDays(today),general=new Set(data.plans.filter(p=>p.kind==='general'&&(planId==='all'||p.id===planId)).map(p=>p.id));
 const tasks=data.tasks.filter(t=>general.has(t.plan_id)&&!t.routine_id&&(period==='all'||!!t.due_date&&t.due_date>=days[0]&&t.due_date<=days[6]));
 const ids=new Set(tasks.map(t=>t.id)),runs=data.runs.filter(r=>r.ended_at&&ids.has(r.task_id));
 const blockedIds=new Set(runs.filter(r=>r.blocked_reason.trim()).map(r=>r.task_id));
 const actualIds=new Set(runs.map(r=>r.task_id));
 const evidence:Record<Metric,Task[]>={planned:tasks,complete:tasks.filter(t=>t.complete),delayed:tasks.filter(t=>!t.complete&&!!t.due_date&&t.due_date<today),blocked:tasks.filter(t=>blockedIds.has(t.id)),expected:tasks,actual:tasks.filter(t=>actualIds.has(t.id)),difference:tasks};
 const expected=tasks.reduce((n,t)=>n+t.estimated_minutes*60000,0),actual=runs.reduce((n,r)=>n+Number(r.work_seconds)*1000,0);
 const values:Record<Metric,number>={planned:tasks.length,complete:evidence.complete.length,delayed:evidence.delayed.length,blocked:evidence.blocked.length,expected,actual,difference:actual-expected};
 return {tasks,runs,evidence,values};
}
export function usageForDay(data:Snapshot,day:string){
 const {from,to}=dayWindow(day),totals={work:0,break:0,interrupt:0};
 const rows=data.runs.filter(r=>r.ended_at&&Date.parse(r.started_at)<to&&Date.parse(r.ended_at)>from).map(r=>{
  const parts={work:0,break:0,interrupt:0};for(const s of r.segments){const length=Math.max(0,Math.min(to,Date.parse(s.ended_at!))-Math.max(from,Date.parse(s.started_at)));parts[s.kind==='pause'?'interrupt':s.kind]+=length;}for(const key of ['work','break','interrupt'] as const)totals[key]+=parts[key];return {run:r,parts};
 });return {day,totals,rows};
}
export function duration(ms:number){
 const rounded=Math.round(ms/1000),sign=rounded<0?'−':'',total=Math.abs(rounded),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
 return sign+(hours?`${hours}시간 ${minutes}분`:`${minutes}분`)+(seconds?` ${seconds}초`:'');
}
