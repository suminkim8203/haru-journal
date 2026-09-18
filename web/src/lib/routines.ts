import type {Routine,Snapshot} from './contracts.ts';
import {addDays,dayWindow,seoulDate} from './schedule.ts';
export type RoutineDraft={title:string;description:string;startDate:string;endDate:string;estimatedMinutes:number;priority:'high'|'normal'|'low';tags:string[];timing:'flex'|'fixed';time:string;allowOverlap:boolean};
export function routinePreview(data:Snapshot,rule:Routine|undefined,draft:RoutineDraft){
 const from=draft.startDate,to=draft.endDate,total=Math.floor((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)+1;
 const rows=(rule?.occurrences||[]).filter(t=>t.date>=from),protectedRows=rows.filter(t=>!!t.reason),targets=rows.filter(t=>!t.reason&&t.date<=to),removed=rows.filter(t=>!t.reason&&t.date>to);
 const existing=new Set((rule?.occurrences||[]).map(t=>t.date)),today=seoulDate();let added=0;const addedDates:string[]=[];
 const minimum=rule&&from<today?today:from,maximum=rule?.stopped_from&&rule.stopped_from<=to?addDays(rule.stopped_from,-1):to;
 if(Number.isFinite(total)&&total>0&&minimum<=maximum){const count=Math.floor((Date.parse(maximum+'T00:00:00Z')-Date.parse(minimum+'T00:00:00Z'))/86400000)+1;
  added=count-[...existing].filter(d=>d>=minimum&&d<=maximum).length;
  for(let i=0;added>0&&i<count&&addedDates.length<50;i++){const date=addDays(minimum,i);if(!existing.has(date))addedDates.push(date);}
 }
 const parent=data.plans.find(p=>p.id===rule?.plan_id),changedIds=new Set([...targets,...removed].map(t=>t.id));
 const conflicts=draft.timing==='fixed'?data.placements.filter(p=>{
  if(changedIds.has(p.task_id))return false;
  const offset=(Number(draft.time.slice(0,2))*60+Number(draft.time.slice(3)))*60000,base=dayWindow(from).from,unit=86400000;
  // Candidate dates follow interval intersection, including placements spanning several days.
  const first=Math.max(0,Math.floor((Date.parse(p.started_at)-offset-draft.estimatedMinutes*60000-base)/unit)+1),last=Math.min(total-1,Math.ceil((Date.parse(p.ended_at)-offset-base)/unit)-1);
  const targetDates=new Set(targets.map(t=>t.date));
  for(let i=first;i<=last;i++){const date=addDays(from,i);if(rule&&date<today)continue;
   if(rule&&!targetDates.has(date)&&(existing.has(date)||rule.stopped_from&&date>=rule.stopped_from))continue;
   return true;
  }return false;
 }):[];
 return {valid:Number.isFinite(total)&&total>0,total,targets,removed,protectedRows,added,addedDates,conflicts,expands:!!parent&&(from<parent.start_date!||to>parent.end_date!)};
}
