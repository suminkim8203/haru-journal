'use client';
import {useState} from 'react';
import type {Plan,Routine,Task} from '@/lib/contracts';
import {addDays,seoulDate} from '@/lib/schedule';
import {routinePreview,type RoutineDraft} from '@/lib/routines';
import {useJournal} from './journal-provider';
import {DateField} from './date-field';
import {TimeField} from './time-field';
export function RoutineEditor({plan,rule,task,onClose}:{plan:Plan;rule?:Routine;task?:Task;onClose:()=>void}){
 const {data,locked,send}=useJournal();const [scope,setScope]=useState(task?'one':'future'),[custom,setCustom]=useState(false),[review,setReview]=useState(false),[tagText,setTagText]=useState((task?.tags.map(t=>t.name)||rule?.tags||[]).join(', '));
 const [draft,setDraft]=useState<RoutineDraft>({title:task?.title||rule?.title||'',description:task?.description||rule?.description||'',startDate:task?.occurrence_date||(rule?seoulDate()>rule.end_date?rule.end_date:seoulDate()<rule.start_date?rule.start_date:seoulDate():plan.start_date||seoulDate()),endDate:rule?.end_date||plan.end_date||addDays(seoulDate(),30),estimatedMinutes:task?.estimated_minutes||rule?.estimated_minutes||30,priority:task?.priority||rule?.priority||'normal',tags:[],timing:rule?.timing||'flex',time:rule?.start_time?.slice(0,5)||'09:00',allowOverlap:false});
 const tags=tagText.split(',').map(t=>t.trim()).filter(Boolean),value={...draft,tags},impact=data?routinePreview(data,rule,value):null;
 function update<T extends keyof RoutineDraft>(key:T,v:RoutineDraft[T]){setDraft(d=>({...d,[key]:v,allowOverlap:false}));setReview(false);}
 return <form className="editor" onSubmit={async e=>{e.preventDefault();if(!review){setReview(true);return;}const saved=task&&scope==='one'?await send('update_task',{taskId:task.id,title:value.title,description:value.description,estimatedMinutes:value.estimatedMinutes,priority:value.priority,tags}):await send(rule?'update_routine':'create_routine',{...value,...(rule?{routineId:rule.id}:{planId:plan.id})});if(saved)onClose();}}>
 <div className="section-heading"><h3>{rule?'반복 할 일 수정':'반복 할 일 만들기'}</h3><button type="button" className="text-button" aria-label="반복 입력 닫기" onClick={onClose}>×</button></div><fieldset disabled={locked}>
 {task&&<label>적용 범위<select value={scope} onChange={e=>{setScope(e.target.value);setReview(false);}}><option value="one">이 날짜만</option><option value="future">이 날짜부터 이후 반복</option></select></label>}
 {!review&&<><label>할 일 제목<input required maxLength={120} value={draft.title} onChange={e=>update('title',e.target.value)}/></label>
 <div className="form-grid"><label>한 번의 예상 시간 · 분<input type="number" required min={1} max={10080} value={draft.estimatedMinutes} onChange={e=>update('estimatedMinutes',Number(e.target.value))}/></label><label>우선순위<select value={draft.priority} onChange={e=>update('priority',e.target.value as RoutineDraft['priority'])}><option value="high">높음</option><option value="normal">보통</option><option value="low">낮음</option></select></label></div>
 {scope==='one'&&task?<p className="field-help">{task.occurrence_date}의 제목·예상 시간·우선순위·설명·태그만 변경합니다. 시간 배치는 할 일 상세에서 별도로 변경합니다.</p>:<>
 <p className="field-help">매일 반복하며 날짜별 완료와 실행 기록은 독립적으로 관리합니다. 계획 기간 {plan.start_date}–{plan.end_date}</p>
 {!rule&&<label className="complete-control"><input type="checkbox" checked={custom} onChange={e=>{setCustom(e.target.checked);setReview(false);if(!e.target.checked)setDraft(d=>({...d,startDate:plan.start_date!,endDate:plan.end_date!,allowOverlap:false}));}}/>이 할 일의 반복 기간 따로 설정</label>}
 {(rule||custom)&&<div className="form-grid"><DateField label={rule?'변경 적용 시작일':'반복 시작일'} required value={draft.startDate} onChange={v=>update('startDate',v)}/><DateField label="반복 종료일" required value={draft.endDate} onChange={v=>update('endDate',v)}/></div>}
 <label>시간 배치 방식<select value={draft.timing} onChange={e=>update('timing',e.target.value as 'flex'|'fixed')}><option value="flex">시각 없이 반복</option><option value="fixed">정해진 시각에 반복</option></select></label>{draft.timing==='fixed'&&<TimeField label="매일 시작 시각" value={draft.time} onChange={v=>update('time',v)}/>}
 </>}
 <label>태그 · 쉼표로 구분<input value={tagText} onChange={e=>{setTagText(e.target.value);setReview(false);}}/></label><label>설명<textarea className="record-input" maxLength={4000} value={draft.description} onChange={e=>update('description',e.target.value)}/></label></>}
 {review&&<section aria-label="반복 적용 대상 확인"><h4 className="task-title">{draft.title}</h4>{scope==='one'&&task?<p>선택한 날짜 1개만 변경합니다. 이후 반복·실제 실행 기록은 유지합니다.</p>:<>
 <p>{draft.startDate}–{draft.endDate} · 수정 {impact?.targets.length||0}개 · 추가 {impact?.added||0}개 · 기간 제외 {impact?.removed.length||0}개 · 보존 {impact?.protectedRows.length||0}개</p>
 <p className="field-help">과거·완료·실행 이력·개별 수정·건너뛰기·중단 항목을 보존합니다. 실제 기록은 덮어쓰지 않습니다.</p>
 {(impact?.expands||draft.startDate<plan.start_date!||draft.endDate>plan.end_date!)&&<p className="field-help">부모 계획의 기간도 함께 확장하고 변경 전 계획을 보존합니다. 자동으로 축소하지 않습니다.</p>}
 <details><summary>적용 날짜와 보존 이유</summary><ul>{impact?.targets.slice(0,50).map(t=><li key={t.id}>{t.date} · 수정</li>)}{impact?.addedDates.map(d=><li key={d}>{d} · 추가</li>)}{impact?.removed.slice(0,50).map(t=><li key={t.id}>{t.date} · 기간 제외</li>)}{impact?.protectedRows.slice(0,50).map(t=><li key={t.id}>{t.date} · 보존: {t.reason}</li>)}</ul><p className="field-help">각 목록은 처음 50개를 표시합니다. 위 개수는 전체 적용 대상입니다.</p></details>
 {draft.estimatedMinutes>1440&&(impact?.total||0)>1&&<p role="alert">한 번의 배치가 24시간보다 길어 다른 날짜의 반복 배치와 겹칩니다.</p>}
 {!!impact?.conflicts.length&&<p role="alert">예정 배치 {impact.conflicts.length}건과 시간이 겹칩니다.</p>}
 {draft.timing==='fixed'&&<label className="complete-control"><input type="checkbox" checked={draft.allowOverlap} onChange={e=>setDraft(d=>({...d,allowOverlap:e.target.checked}))}/>예정 시간 겹침을 확인했으며 그대로 배치</label>}
 </>}</section>}
 <div className="actions">{review&&<button type="button" className="text-button" onClick={()=>setReview(false)}>내용으로 돌아가기</button>}<button type="submit" className="primary" disabled={review&&scope!=='one'&&!impact?.valid}>{review?'변경 확정':'적용 대상 확인'}</button></div>
 </fieldset></form>;
}
export function RoutineRules({plan}:{plan:Plan}){
 const {data,locked,send}=useJournal();const [editing,setEditing]=useState<Routine|null>(null),[creating,setCreating]=useState(false),[stopping,setStopping]=useState<Routine|null>(null),[from,setFrom]=useState(seoulDate());
 const rules=data?.routines?.filter(r=>r.plan_id===plan.id)||[],stopTargets=stopping?.occurrences.filter(t=>t.date>=from&&!t.reason)||[];
 return <section><div className="section-heading"><h3>반복 할 일 {rules.length}개</h3><button disabled={locked||creating||!!editing} onClick={()=>{setCreating(true);setEditing(null);}}>반복 할 일 추가</button></div><p className="field-help">날짜별 완료와 단상은 일정의 일간에서 확인합니다.</p>
 {(creating||editing)&&<RoutineEditor key={editing?.id||'new'} plan={plan} rule={editing||undefined} onClose={()=>{setCreating(false);setEditing(null);}}/>}
 {rules.map(r=><article className="run-row" key={r.id}><h4 className="task-title">{r.title}</h4><p className="field-help">{r.start_date}–{r.end_date} · 매일 {r.estimated_minutes}분 · {r.timing==='fixed'?r.start_time?.slice(0,5):'시간 미정'}{r.stopped_from?' · '+r.stopped_from+'부터 중단':''}</p><div className="side-actions"><button className="text-button" disabled={locked||creating} onClick={()=>setEditing(r)}>반복 규칙 수정</button><button className="text-button" disabled={locked||!!r.stopped_from} onClick={()=>{setStopping(r);setFrom(seoulDate()<r.start_date?r.start_date:seoulDate()>r.end_date?r.end_date:seoulDate());}}>이후 반복 중단</button></div></article>)}
 {stopping&&<form className="editor" onSubmit={async e=>{e.preventDefault();if(await send('stop_routine',{routineId:stopping.id,fromDate:from}))setStopping(null);}}><h4 className="task-title">{stopping.title} · 이후 반복 중단</h4><DateField label="중단 기준 날짜" required min={stopping.start_date} max={stopping.end_date} value={from} onChange={setFrom}/><p>중단 {stopTargets.length}개 · 보존 {(stopping.occurrences.filter(t=>t.date>=from).length-stopTargets.length)}개</p><p className="field-help">보존할 기록은 유지하며 중단한 날짜는 휴지통에서 복원할 수 있습니다.</p><div className="actions"><button className="text-button" type="button" onClick={()=>setStopping(null)}>취소</button><button disabled={locked}>이후 반복 중단</button></div></form>}
 </section>;
}
