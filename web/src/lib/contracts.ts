export const DIARY_ID='00000000-0000-4000-8000-000000000006';
export interface Plan {id:string;title:string;kind:'general'|'routine';start_date:string|null;end_date:string|null;success_text:string;estimated_minutes:number}
export interface Task {id:string;plan_id:string;title:string;description:string;due_date:string|null;estimated_minutes:number;priority:'high'|'normal'|'low';complete:boolean}
export interface Snapshot {diaryId:string;timezone:string;revision:number;plans:Plan[];tasks:Task[]}
export interface Command {requestId:string;expectedRevision:number;command:'create_plan'|'create_task'|'set_task_complete';payload:Record<string,unknown>}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(x:unknown):x is Record<string,unknown>{return !!x&&typeof x==='object'&&!Array.isArray(x)}
export function validDate(x:unknown):x is string {if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x))return false;const date=new Date(x+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===x&&x>='0001-01-01';}
export function parseCommand(input:unknown):Command {
 if(!object(input)||typeof input.requestId!=='string'||!uuid.test(input.requestId)||!Number.isSafeInteger(input.expectedRevision)||Number(input.expectedRevision)<0||!object(input.payload))throw Error('저장 요청 형식을 확인해 주세요.');
 const p=input.payload,c=input.command;
 const text=(key:string,max:number,required=false)=>{const v=p[key];if(v===undefined&&!required)return;if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('입력한 글의 길이를 확인해 주세요.');};
 const number=(max:number)=>{if(p.estimatedMinutes!==undefined&&(!Number.isInteger(p.estimatedMinutes)||Number(p.estimatedMinutes)<0||Number(p.estimatedMinutes)>max))throw Error('예상 시간을 확인해 주세요.');};
 if(c==='create_plan'){text('title',120,true);text('successText',4000);number(525600);if(p.kind!=='general'||!validDate(p.startDate)||!validDate(p.endDate)||p.startDate>p.endDate)throw Error('계획 시작일과 종료일을 확인해 주세요.');}
 else if(c==='create_task'){text('title',120,true);text('description',4000);number(10080);if(typeof p.planId!=='string'||!uuid.test(p.planId))throw Error('계획을 선택해 주세요.');if(p.dueDate!==undefined&&p.dueDate!==''&&!validDate(p.dueDate))throw Error('마감일을 확인해 주세요.');if(p.priority!==undefined&&!['high','normal','low'].includes(String(p.priority)))throw Error('우선순위를 확인해 주세요.');}
 else if(c==='set_task_complete'){if(typeof p.taskId!=='string'||!uuid.test(p.taskId)||typeof p.complete!=='boolean')throw Error('완료 상태를 확인해 주세요.');}
 else throw Error('아직 지원하지 않는 저장 요청입니다.');
 return input as unknown as Command;
}
