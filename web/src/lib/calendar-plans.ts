import type {Plan,Snapshot,Task} from './contracts.ts';
import {seoulDate} from './schedule.ts';

/** The period is a plan's intended span, not evidence that work happened on every day. */
export function plansOnDay(data:Snapshot,day:string):Plan[]{
 return data.plans.filter(plan=>plan.start_date&&plan.end_date&&plan.start_date<=day&&day<=plan.end_date)
  .sort((a,b)=>a.start_date!.localeCompare(b.start_date!)||a.title.localeCompare(b.title,'ko')||a.id.localeCompare(b.id));
}

export function tasksInPlan(data:Snapshot,plan:Plan,day?:string):Task[]{
 return data.tasks.filter(task=>task.plan_id===plan.id&&!task.skipped&&!task.cancelled_at&&(!day||plan.kind==='general'||task.occurrence_date===day))
  .sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.title.localeCompare(b.title,'ko')||a.id.localeCompare(b.id));
}

export function planCompletion(data:Snapshot,plan:Plan,day?:string){
 const tasks=tasksInPlan(data,plan,day),done=tasks.filter(task=>task.complete).length;
 return {done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0};
}

export function planWeekSegments(plans:Plan[],weekStart:string,weekEnd:string,monthFirst:string,monthLast:string){
 return plans.filter(plan=>plan.start_date&&plan.end_date).map(plan=>{
  const start=[plan.start_date!,weekStart,monthFirst].sort().at(-1)!;
  const end=[plan.end_date!,weekEnd,monthLast].sort()[0];
  return {plan,start,end,label:start===[plan.start_date!,monthFirst].sort().at(-1)};
 }).filter(segment=>segment.start<=segment.end);
}

/** Hide only after a known completion date; old snapshots without it stay visible. */
export function completedPlanHidden(data:Snapshot,plan:Plan,day:string):boolean{
 if(plan.kind!=='general')return false;
 const tasks=tasksInPlan(data,plan);
 if(!tasks.length||tasks.some(task=>!task.complete||!task.completed_at))return false;
 const finished=tasks.map(task=>seoulDate(new Date(task.completed_at!))).sort().at(-1)!;
 return day>finished;
}
