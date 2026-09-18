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
export interface Snapshot { schemaVersion: 2; diaryId: string; timezone: string; revision: number; plans: Plan[]; tasks: Task[] }
export interface Command {
  requestId: string; expectedRevision: number;
  command: 'create_plan' | 'update_plan' | 'create_task' | 'update_task' | 'set_task_complete';
  payload: Record<string, unknown>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(x: unknown): x is Record<string, unknown> { return !!x && typeof x === 'object' && !Array.isArray(x) }
export function compatibleSnapshot(input: unknown): input is Snapshot {
  return object(input) && input.schemaVersion === 2 && input.diaryId === DIARY_ID
    && input.timezone === 'Asia/Seoul' && Number.isSafeInteger(input.revision) && Number(input.revision) >= 0
    && Array.isArray(input.plans) && Array.isArray(input.tasks);
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
  if (c === 'create_plan' || c === 'update_plan') {
    text('title', 120, true); text('successText', 4000); estimate(525600); priority();
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
    id('taskId'); if (typeof p.complete !== 'boolean') throw Error('완료 상태를 확인해 주세요.');
  } else throw Error('아직 지원하지 않는 저장 요청입니다.');
  return { requestId: input.requestId, expectedRevision: Number(input.expectedRevision), command: c, payload: p };
}
