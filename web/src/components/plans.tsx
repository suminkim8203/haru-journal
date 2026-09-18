'use client';
import { useEffect, useState } from 'react';
import type { Command, Plan, Priority, Task } from '@/lib/contracts';
import { visibleTasks, type TaskView } from '@/lib/task-view';
import { useJournal } from './journal-provider';
import {RoutineRules} from './routines';
import {addDays} from '@/lib/schedule';
import { DateField } from './date-field';

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
const priorityName = (priority: Priority) => ({ high: '높음', normal: '보통', low: '낮음' })[priority];
const newPlan = () => ({ kind:'general' as 'general'|'routine',title: '', startDate: today(), endDate: today(), successText: '', estimatedMinutes: 0, priority: 'normal' as Priority });
const newTask = () => ({ title: '', dueDate: '', estimatedMinutes: 30, priority: 'normal' as Priority, description: '', tags: [] as string[], tagDraft: '' });
function PriorityField({ value, onChange }: { value: Priority; onChange: (value: Priority) => void }) {
  return <label>우선순위<select value={value} onChange={e => onChange(e.target.value as Priority)}>
    <option value="high">높음</option><option value="normal">보통</option><option value="low">낮음</option>
  </select></label>;
}

export function Plans() {
  const {data,locked,blocked,send:dispatch}=useJournal();
  const [error,setError]=useState('');
  const [planId, setPlanId] = useState(data?.plans[0]?.id || '');
  const [planOpen, setPlanOpen] = useState(false), [planEditing, setPlanEditing] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false), [taskEditing, setTaskEditing] = useState<string | null>(null);
  const [plan, setPlan] = useState(newPlan), [task, setTask] = useState(newTask);
  const [view, setView] = useState<TaskView>({ query: '', status: 'all', tag: '', sort: 'due' });
  useEffect(()=>{if(data&&!data.plans.some(p=>p.id===planId)){setPlanId(data.plans[0]?.id||'');setView(previous=>({...previous,tag:''}));}},[data,planId]);
  async function send(command:Command['command'],payload:Record<string,unknown>){
    const value=await dispatch(command,payload);if(!value)return;
    if(command==='create_plan'||command==='update_plan'){setPlanOpen(false);setPlanEditing(null);setPlan(newPlan());setPlanId(value.entityId||String());}
    if(command==='create_task'||command==='update_task'){setTaskOpen(false);setTaskEditing(null);setTask(newTask());}
  }
  function editPlan(value: Plan) {
    setPlan({ kind:value.kind,title: value.title, startDate: value.start_date || '', endDate: value.end_date || '', successText: value.success_text, estimatedMinutes: value.estimated_minutes, priority: value.priority });
    setPlanEditing(value.id); setPlanOpen(true);
  }
  function editTask(value: Task) {
    setTask({ title: value.title, dueDate: value.due_date || '', estimatedMinutes: value.estimated_minutes, priority: value.priority, description: value.description, tags: value.tags.map(tag => tag.name), tagDraft: '' });
    setTaskEditing(value.id); setTaskOpen(true);
  }
  const selected = data?.plans.find(p => p.id === planId);
  const tasks = data?.tasks.filter(t => t.plan_id === planId) || [];
  const shown = visibleTasks(tasks, view);
  const tags = [...new Map(tasks.flatMap(t => t.tags).map(tag => [tag.id, tag])).values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const addTag = () => {
    const name = task.tagDraft.trim();
    if (!name) return;
    if (task.tags.length >= 20 && !task.tags.includes(name)) { setError('태그는 최대 20개까지 입력할 수 있습니다.'); return; }
    setTask({ ...task, tags: [...new Set([...task.tags, name])], tagDraft: '' });
  };

  return <>
    <div className="page-title"><div><small>PLAN</small><h2>계획</h2></div>
      <button disabled={!data || locked || planOpen || taskOpen} onClick={() => { setPlan(newPlan()); setPlanEditing(null); setPlanOpen(true); }}>새 계획</button></div>
    {error && <p role="alert">{error}</p>}
    {!data && <section className="empty"><h3>저장소 연결을 준비하고 있습니다.</h3><p>연결 후 계획과 할 일을 저장할 수 있습니다.</p></section>}
    {planOpen && <form className="editor" onSubmit={e => { e.preventDefault(); void send(planEditing ? 'update_plan' : 'create_plan', { ...plan, ...(planEditing ? { planId: planEditing } : {}) }); }}>
      <h3>{planEditing ? '계획 수정' : '계획 만들기'}</h3><fieldset disabled={locked}>
        {!planEditing&&<label>계획 종류<select value={plan.kind} onChange={e=>setPlan({...plan,kind:e.target.value as 'general'|'routine',endDate:e.target.value==='routine'?addDays(plan.startDate,30):plan.endDate})}><option value="general">일반 계획</option><option value="routine">매일의 루틴</option></select></label>}
        <label>계획 제목<input required maxLength={120} value={plan.title} onChange={e => setPlan({ ...plan, title: e.target.value })} /></label>
        <div className="form-grid"><DateField label="시작일" required value={plan.startDate} onChange={startDate => setPlan({ ...plan, startDate })} /><DateField label="종료일" required value={plan.endDate} onChange={endDate => setPlan({ ...plan, endDate })} />
          <PriorityField value={plan.priority} onChange={priority => setPlan({ ...plan, priority })} />
          <label>계획 예상 시간 · 분<input type="number" required min={0} max={525600} step={1} value={plan.estimatedMinutes} onChange={e => setPlan({ ...plan, estimatedMinutes: Number(e.target.value) })} /></label></div>
        <p className="field-help">계획 전체의 예상입니다. 할 일 예상 합계와 별도로 저장합니다.</p>
        <label>성공 기준<textarea maxLength={4000} value={plan.successText} onChange={e => setPlan({ ...plan, successText: e.target.value })} /></label>
        <div className="actions"><button type="button" onClick={() => setPlanOpen(false)}>닫기</button><button className="primary" type="submit">{locked ? '저장 중…' : planEditing ? '변경 저장' : '계획 저장'}</button></div>
      </fieldset></form>}
    {!!data?.plans.length && <>
      <label className="plan-picker">계획 선택<select disabled={locked || planOpen || taskOpen} value={planId} onChange={e => { setPlanId(e.target.value); setView({ ...view, tag: '' }); }}>
        <option value="">선택하세요</option>{data.plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      {selected && <>
        <section className="plan-heading"><div className="section-heading"><h3>{selected.title}</h3><div className="actions"><button disabled={locked || planOpen || taskOpen} onClick={() => editPlan(selected)}>계획 수정</button><button className="text-button" disabled={locked} onClick={()=>{if(window.confirm('계획과 소속 할 일·예정 배치를 휴지통으로 옮길까요? 실제 기록·단상·회고는 남습니다.'))void send('delete_entity',{entityType:'plan',entityId:selected.id,at:new Date().toISOString()});}}>삭제</button></div></div>
          <p>{selected.start_date} — {selected.end_date} · 우선순위 {priorityName(selected.priority)}</p>
          <p>계획 예상 {selected.estimated_minutes}분 · 할 일 예상 합계 {tasks.reduce((sum, task) => sum + task.estimated_minutes, 0)}분</p>
          {data?.improvements.filter(i=>i.target_plan_id===selected.id).map(i=><p className="record-body" key={i.id}>개선점 · {i.source_text}</p>)}
          {selected.success_text && <p>{selected.success_text}</p>}
          {!!selected.history.length && <details className="plan-history"><summary>수정 이력 · {selected.history.length}건</summary><ol>
            {selected.history.map(item => <li key={item.id}><p>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.changed_at))} 수정 전</p>
              <h4 className="task-title">{item.previous_value.title}</h4><p>{item.previous_value.start_date} — {item.previous_value.end_date} · 예상 {item.previous_value.estimated_minutes}분 · 우선순위 {item.previous_value.priority ? priorityName(item.previous_value.priority) : '이전 기록에 없음'}</p>
              {item.previous_value.success_text && <p>{item.previous_value.success_text}</p>}</li>)}
          </ol></details>}</section>
        {selected.kind==='routine'?<RoutineRules plan={selected}/>:<>
        <div className="section-heading"><h3>할 일 <small>{tasks.length}</small></h3><button disabled={locked || taskOpen || planOpen} onClick={() => { setTask(newTask()); setTaskEditing(null); setTaskOpen(true); }}>할 일 추가</button></div>
        {taskOpen && <form className="editor" onSubmit={e => {
          e.preventDefault(); const { tagDraft, tags, ...fields } = task;
          const names = [...new Set([...tags, ...(tagDraft.trim() ? [tagDraft.trim()] : [])])];
          void send(taskEditing ? 'update_task' : 'create_task', { ...fields, tags: names, ...(taskEditing ? { taskId: taskEditing } : { planId }) });
        }}><h3>{taskEditing ? '할 일 수정' : '할 일 추가'}</h3><fieldset disabled={locked}>
          <label>할 일 제목<input required maxLength={120} value={task.title} onChange={e => setTask({ ...task, title: e.target.value })} /></label>
          <div className="form-grid"><DateField label="마감일" value={task.dueDate} onChange={dueDate => setTask({ ...task, dueDate })} />
            <label>예상 시간 · 분<input type="number" required min={0} max={10080} step={1} value={task.estimatedMinutes} onChange={e => setTask({ ...task, estimatedMinutes: Number(e.target.value) })} /></label>
            <PriorityField value={task.priority} onChange={priority => setTask({ ...task, priority })} />
            <div className="tag-field"><label>태그<input maxLength={30} placeholder="태그 입력 후 Enter" value={task.tagDraft} onChange={e => setTask({ ...task, tagDraft: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addTag(); } }} /></label>
              <button type="button" onClick={addTag} disabled={!task.tagDraft.trim() || task.tags.length >= 20}>추가</button>
              <div className="tag-chips">{task.tags.map(name => <span key={name}>{name}<button type="button" aria-label={name + ' 태그 제거'} onClick={() => setTask({ ...task, tags: task.tags.filter(tag => tag !== name) })}>×</button></span>)}</div>
              <span className="field-help">각 30자 이내, 최대 20개. 입력 중인 태그도 저장에 포함됩니다.</span></div></div>
          <label>설명<textarea className="record-input" maxLength={4000} value={task.description} onChange={e => setTask({ ...task, description: e.target.value })} /></label>
          <div className="actions"><button type="button" onClick={() => setTaskOpen(false)}>닫기</button><button className="primary" type="submit">{locked ? '저장 중…' : taskEditing ? '변경 저장' : '할 일 저장'}</button></div>
        </fieldset></form>}
        <div className="task-tools"><label>검색<input type="search" placeholder="제목·설명·태그 검색" value={view.query} onChange={e => setView({ ...view, query: e.target.value })} /></label>
          <label>상태<select value={view.status} onChange={e => setView({ ...view, status: e.target.value as TaskView['status'] })}><option value="all">모든 상태</option><option value="active">미완료</option><option value="complete">완료</option></select></label>
          <label>태그<select value={view.tag} onChange={e => setView({ ...view, tag: e.target.value })}><option value="">모든 태그</option>{tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
          <label>정렬<select value={view.sort} onChange={e => setView({ ...view, sort: e.target.value as TaskView['sort'] })}><option value="due">마감일 빠른 순</option><option value="priority">우선순위 높은 순</option><option value="title">제목 순</option></select></label></div>
        <p className="field-help">{shown.length} / {tasks.length}개 · {view.sort === 'due' ? '마감일 없는 항목은 마지막' : view.sort === 'priority' ? '높음 → 보통 → 낮음' : '제목 문자 순'} · 같은 값은 ID 순으로 정렬합니다.</p>
        <div className="task-list">{shown.map(t => <article key={t.id} className="task-row">
          <input type="checkbox" checked={t.complete} disabled={blocked} aria-label={t.title + ' 완료'} onChange={e => void send('set_task_complete', { taskId: t.id, complete: e.target.checked })} />
          <div><strong className="task-title">{t.title}</strong><p>{t.due_date || '마감일 없음'} · 예상 {t.estimated_minutes}분 · 우선순위 {priorityName(t.priority)}{t.complete ? ' · 완료' : ''}</p>
            {!!t.tags.length && <p className="task-tags">{t.tags.map(tag => <span key={tag.id}>#{tag.name}</span>)}</p>}{t.description && <p className="record-body">{t.description}</p>}</div>
          <button className="text-button" disabled={locked || taskOpen || planOpen} onClick={() => editTask(t)}>수정</button><button className="text-button" disabled={locked} onClick={()=>{if(window.confirm('이 할 일과 예정 배치를 휴지통으로 옮길까요? 실제 기록·단상·회고는 남습니다.'))void send('delete_entity',{entityType:'task',entityId:t.id,at:new Date().toISOString()});}}>삭제</button>
        </article>)}{!shown.length && <p className="empty">{tasks.length ? '조건에 맞는 할 일이 없습니다.' : '할 일을 추가해 계획을 구체화해 보세요.'}</p>}</div>
        </>}
      </>}
    </>}
    {data && !data.plans.length && !planOpen && <p className="empty">첫 계획을 만들어 보세요.</p>}
  </>;
}
