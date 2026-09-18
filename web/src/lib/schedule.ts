import type {Run,Snapshot} from './contracts.ts';
import {workMilliseconds} from './time.ts';
export const seoulDate=(time:number|Date=Date.now())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(time);
export function addDays(day:string,n:number){return new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
export function dayWindow(day:string){const from=Date.parse(day+'T00:00:00+09:00');return {from,to:from+86400000};}
export function weekDays(day:string){const weekday=new Date(day+'T00:00:00Z').getUTCDay();return Array.from({length:7},(_,i)=>addDays(day,i-weekday));}
export function overlaps(start:string,end:string|null,day:string,now=Date.now()){const {from,to}=dayWindow(day);return Date.parse(start)<to&&(end?Date.parse(end):now)>from;}
export const clockLabel=(instant:string|number)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant));
export function localInstant(day:string,time:string){if(!/^\d{2}:\d{2}$/.test(time)||Number(time.slice(0,2))>23||Number(time.slice(3))>59)throw Error('시:분 형식으로 시간을 입력해 주세요.');return new Date(day+'T'+time+':00+09:00').toISOString();}
export function runWork(run:Run,from=-8640000000000000,to=8640000000000000,now=Date.now()){return workMilliseconds(run.segments.map(s=>({kind:s.kind,start:Date.parse(s.started_at),end:s.ended_at?Date.parse(s.ended_at):null})),from,to,now);}
export function dayItems(data:Snapshot,day:string,now=Date.now()){
 const placements=data.placements.filter(p=>overlaps(p.started_at,p.ended_at,day,now));
 const runs=data.runs.filter(r=>overlaps(r.started_at,r.ended_at,day,now));
 const tasks=data.tasks.filter(t=>t.due_date===day||placements.some(p=>p.task_id===t.id)||runs.some(r=>r.task_id===t.id));
 return {placements,runs,tasks};
}
export type PauseDraft={kind:'break'|'interrupt';start:string;end:string};
export function manualSegments(start:string,end:string,pauses:PauseDraft[]){
 const from=Date.parse(start),to=Date.parse(end);if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)throw Error('종료 시각은 시작 시각 이후여야 합니다.');
 const sorted=pauses.map(p=>({...p,a:Date.parse(p.start),b:Date.parse(p.end)})).sort((a,b)=>a.a-b.a);
 const segments:{kind:string;startedAt:string;endedAt:string}[]=[];let previous=from;
 for(const p of sorted){if(!Number.isFinite(p.a)||!Number.isFinite(p.b)||p.a<previous||p.b<=p.a||p.b>to)throw Error('휴식·중단은 시작·종료 시간 안에서 서로 겹치지 않게 입력해 주세요.');if(p.a>previous)segments.push({kind:'work',startedAt:new Date(previous).toISOString(),endedAt:p.start});segments.push({kind:p.kind,startedAt:p.start,endedAt:p.end});previous=p.b;}
 if(previous<to)segments.push({kind:'work',startedAt:new Date(previous).toISOString(),endedAt:end});return segments;
}
