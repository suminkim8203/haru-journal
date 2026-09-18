export const DIARY_ID = '00000000-0000-4000-8000-000000000006';
export type Priority = 'high' | 'normal' | 'low';
export interface Tag { id: string; name: string }
export interface PlanRevision {
  id: number; changed_at: string;
  previous_value: { title: string; start_date: string; end_date: string; success_text: string; estimated_minutes: number; priority?: Priority };
}
export interface Plan {
  id: string; title: string; kind: 'general' | 'routine';
  start_date: string | null; end_date: string | null;
  success_text: string; estimated_minutes: number; priority: Priority; history: PlanRevision[];
}
export interface Task {
  id: string; plan_id: string; title: string; description: string;
  due_date: string | null; estimated_minutes: number; priority: Priority;
  complete: boolean; tags: Tag[];
}
export interface Placement { id:string; task_id:string; started_at:string; ended_at:string }
export interface Segment { id:string; kind:'work'|'pause'|'break'|'interrupt'; started_at:string; ended_at:string|null }
export interface Run { id:string; task_id:string; started_at:string; ended_at:string|null; source:'live'|'manual'; blocked_reason:string; work_seconds:number|null; segments:Segment[] }
export interface Thought {id:string;task_id:string;local_date:string;body:string}
export interface Reflection {id:string;local_date:string;body:string;bookmarked:boolean;imported_thoughts:{id:string;body:string}[]}
export interface Improvement {id:string;source_plan_id:string;target_plan_id:string;source_text:string}
export interface TrashEntry {id:string;entity_type:'plan'|'task'|'run'|'placement'|'reflection';entity_id:string;title:string;deleted_at:string}
export interface Snapshot { schemaVersion: 4; thoughts:Thought[]; reflections:Reflection[]; closures:{local_date:string;closed_at:string}[]; improvements:Improvement[]; trash:TrashEntry[]; placements:Placement[]; runs:Run[]; diaryId: string; timezone: string; revision: number; plans: Plan[]; tasks: Task[] }
export interface Command {
  requestId: string; expectedRevision: number;
  command: 'create_plan' | 'update_plan' | 'create_task' | 'update_task' | 'set_task_complete' | 'create_placement' | 'update_placement' | 'start_run' | 'switch_segment' | 'stop_run' | 'create_run' | 'update_run' | 'save_thought' | 'save_reflection' | 'close_day' | 'bookmark_reflection' | 'send_improvement' | 'delete_entity' | 'restore_entity';
  payload: Record<string, unknown>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(x: unknown): x is Record<string, unknown> { return !!x && typeof x === 'object' && !Array.isArray(x) }
export function compatibleSnapshot(input: unknown): input is Snapshot {
  return object(input) && input.schemaVersion === 4 && input.diaryId === DIARY_ID
    && input.timezone === 'Asia/Seoul' && Number.isSafeInteger(input.revision) && Number(input.revision) >= 0
    && Array.isArray(input.plans) && Array.isArray(input.tasks) && Array.isArray(input.placements) && Array.isArray(input.runs) && Array.isArray(input.thoughts) && Array.isArray(input.reflections) && Array.isArray(input.closures) && Array.isArray(input.improvements) && Array.isArray(input.trash);
}
export function validDate(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const date = new Date(x + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === x && x >= '0001-01-01';
}
export function parseCommand(input: unknown): Command {
  if (!object(input) || typeof input.requestId !== 'string' || !uuid.test(input.requestId)
    || !Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0 || !object(input.payload)) {
    throw Error('저장 요청 형식을 확인해 주세요.');
  }
  const p = { ...input.payload }, c = input.command;
  const text = (key: string, max: number, required = false) => {
    const v = p[key];
    if (v === undefined && !required) return;
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw Error('입력한 글의 길이를 확인해 주세요.');
  };
  const estimate = (max: number) => {
    if (p.estimatedMinutes !== undefined && (!Number.isInteger(p.estimatedMinutes)
      || Number(p.estimatedMinutes) < 0 || Number(p.estimatedMinutes) > max)) throw Error('예상 시간을 확인해 주세요.');
  };
  const priority = () => {
    if (p.priority !== undefined && (typeof p.priority !== 'string' || !['high', 'normal', 'low'].includes(p.priority))) throw Error('우선순위를 확인해 주세요.');
  };
  const id = (key: string) => {
    if (typeof p[key] !== 'string' || !uuid.test(p[key])) throw Error('대상을 다시 선택해 주세요.');
  };
  const instant = (key: string) => {
    if (typeof p[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(p[key] as string) || !Number.isFinite(Date.parse(p[key] as string))) throw Error('시간을 확인해 주세요.');
  };
  if (c === 'save_thought' || c === 'save_reflection' || c === 'close_day') {
    if (!validDate(p.date)) throw Error('기록 날짜를 확인해 주세요.');
    text('body',c==='save_thought'?4000:4000,c!=='close_day'); if(c==='save_thought')id('taskId');
    if(p.imports!==undefined && (!Array.isArray(p.imports) || p.imports.length>500 || p.imports.some(x=>!object(x)||typeof x.id!=='string'||!uuid.test(x.id)||typeof x.body!=='string'||x.body.length>4000))) throw Error('가져올 단상을 확인해 주세요.');
  } else if(c==='bookmark_reflection') {
    id('reflectionId'); if(typeof p.bookmarked!=='boolean')throw Error('책갈피 상태를 확인해 주세요.');
  } else if(c==='send_improvement') {
    id('sourcePlanId');id('targetPlanId');text('body',500,true);if(p.sourcePlanId===p.targetPlanId)throw Error('다음 계획을 선택해 주세요.');
  } else if(c==='delete_entity') {
    id('entityId');if(!['plan','task','run','placement','reflection'].includes(String(p.entityType)))throw Error('삭제할 항목을 확인해 주세요.');if(p.at!==undefined)instant('at');
  } else if(c==='restore_entity') {
    id('trashId');
  } else if (c === 'create_placement' || c === 'update_placement' || c === 'create_run' || c === 'update_run') {
    if(p.allowOverlap!==undefined&&typeof p.allowOverlap!=='boolean')throw Error('시간 겹침 확인을 다시 선택해 주세요.');
    id(c === 'update_run' ? 'runId' : 'taskId'); if (c === 'update_placement') id('placementId');
    instant('startedAt'); instant('endedAt');
    if (Date.parse(p.endedAt as string) <= Date.parse(p.startedAt as string)) throw Error('종료 시각은 시작 시각 이후여야 합니다.');
    text('blockedReason',2000);
    if (c === 'create_run' || c === 'update_run') {
      if (!Array.isArray(p.segments) || !p.segments.length || p.segments.length > 101) throw Error('실행 구간을 확인해 주세요.');
      let previous = Date.parse(p.startedAt as string);
      for (const part of p.segments) {
        if (!object(part) || !['work','pause','break','interrupt'].includes(String(part.kind)) || typeof part.startedAt !== 'string' || typeof part.endedAt !== 'string') throw Error('실행 구간을 확인해 주세요.');
        const a=Date.parse(part.startedAt), b=Date.parse(part.endedAt);
        if (!Number.isFinite(a) || !Number.isFinite(b) || !part.startedAt.endsWith('Z') || !part.endedAt.endsWith('Z') || a!==previous || b<=a || b>Date.parse(p.endedAt as string)) throw Error('휴식·중단은 실행 시간 안에서 겹치지 않게 입력해 주세요.');
        previous=b;
      }
      if (previous!==Date.parse(p.endedAt as string)) throw Error('실행 구간은 전체 기록 시간과 같아야 합니다.');
    }
  } else if (c === 'start_run' || c === 'switch_segment' || c === 'stop_run') {
    id(c === 'start_run' ? 'taskId' : 'runId'); instant('at'); text('blockedReason',2000);
    if (c === 'switch_segment' && !['work','pause','break','interrupt'].includes(String(p.kind))) throw Error('기록 유형을 확인해 주세요.');
  } else if (c === 'create_plan' || c === 'update_plan') {
    text('title', 120, true); text('successText', 4000); estimate(525600); priority();
    if(c==='create_plan' && p.sourcePlanId!==undefined){id('sourcePlanId');text('improvementText',500,true);}
    if ((c === 'create_plan' && p.kind !== 'general') || !validDate(p.startDate)
      || !validDate(p.endDate) || p.startDate > p.endDate) throw Error('계획 시작일과 종료일을 확인해 주세요.');
    if (c === 'update_plan') id('planId');
  } else if (c === 'create_task' || c === 'update_task') {
    text('title', 120, true); text('description', 4000); estimate(10080); priority();
    id(c === 'create_task' ? 'planId' : 'taskId');
    if (p.dueDate !== undefined && p.dueDate !== '' && !validDate(p.dueDate)) throw Error('마감일을 확인해 주세요.');
    if (p.tags !== undefined) {
      if (!Array.isArray(p.tags) || p.tags.length > 20 || p.tags.some(tag => typeof tag !== 'string'
        || !tag.trim() || tag.trim().length > 30)) throw Error('태그는 30자 이내로, 최대 20개까지 입력해 주세요.');
      p.tags = [...new Set((p.tags as string[]).map(tag => tag.trim()))];
    }
  } else if (c === 'set_task_complete') {
    id('taskId'); if (p.at !== undefined) instant('at'); text('blockedReason',2000); if (typeof p.complete !== 'boolean') throw Error('완료 상태를 확인해 주세요.');
  } else throw Error('아직 지원하지 않는 저장 요청입니다.');
  return { requestId: input.requestId, expectedRevision: Number(input.expectedRevision), command: c, payload: p };
}
