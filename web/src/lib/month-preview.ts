import type {Snapshot} from './contracts.ts';
import {overlaps} from './schedule.ts';

/** A calendar day shows each planned task once, preserving its individual placements. */
export function monthEntriesForDay(data:Snapshot,day:string){
 const placements=data.placements.filter(p=>overlaps(p.started_at,p.ended_at,day));
 const placed=new Set(placements.map(p=>p.task_id));
 return data.tasks.filter(t=>!t.skipped&&!t.cancelled_at&&(placed.has(t.id)||t.due_date===day||t.occurrence_date===day))
  .map(task=>({task,placements:placements.filter(p=>p.task_id===task.id).sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at)),due:task.due_date===day}))
  .sort((a,b)=>(Date.parse(a.placements[0]?.started_at||'')||Infinity)-(Date.parse(b.placements[0]?.started_at||'')||Infinity)||a.task.title.localeCompare(b.task.title,'ko')||a.task.id.localeCompare(b.task.id));
}
