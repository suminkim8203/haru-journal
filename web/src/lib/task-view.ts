import type { Task } from './contracts.ts';
export type TaskSort = 'due' | 'priority' | 'title' | 'recent';
export interface TaskView { query: string; status: 'all' | 'active' | 'complete'; tag: string; sort: TaskSort }
const rank = { high: 0, normal: 1, low: 2 };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function visibleTasks(tasks: Task[], view: TaskView): Task[] {
  const query = view.query.trim().toLocaleLowerCase('ko-KR');
  return tasks.filter(task => (!query || [task.title, task.description, ...task.tags.map(tag => tag.name)]
    .join('\n').toLocaleLowerCase('ko-KR').includes(query))
    && (view.status === 'all' || task.complete === (view.status === 'complete'))
    && (!view.tag || task.tags.some(tag => tag.id === view.tag))).sort((a, b) => {
      const primary = view.sort === 'recent' ? compare(b.created_at || '', a.created_at || '') : view.sort === 'priority' ? rank[a.priority] - rank[b.priority]
        : view.sort === 'title' ? compare(a.title, b.title)
        : compare(a.due_date || '9999-12-31', b.due_date || '9999-12-31');
      return primary || (view.sort === 'due' ? rank[a.priority] - rank[b.priority] : 0) || compare(a.created_at || '', b.created_at || '') || compare(a.id, b.id);
    });
}
