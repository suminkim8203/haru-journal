'use client';
import {useState} from 'react';
import type {Task,Thought,Reflection} from '@/lib/contracts';
import {useJournal} from './journal-provider';
import {DateField} from './date-field';
export function Bookmark({active,onClick,disabled=false}:{active:boolean;onClick:()=>void;disabled?:boolean}){return <button className="bookmark-button" aria-label={active?'책갈피 해제':'책갈피 저장'} aria-pressed={active} disabled={disabled} onClick={onClick}><svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1v20l-7-4.5-7 4.5v-20a1 1 0 0 1 1-1Z" fill={active?'currentColor':'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg></button>;}
export function ThoughtEditor({task,day}:{task:Task;day:string}){
 const {data,locked,send}=useJournal(),saved=data?.thoughts.find(t=>t.task_id===task.id&&t.local_date===day);
 const [editing,setEditing]=useState(false),[body,setBody]=useState(saved?.body||'');
 return <details><summary>단상{saved?' · 작성됨':''}</summary>{saved&&!editing?<><p className="record-body">{saved.body}</p><button className="text-button" onClick={()=>{setBody(saved.body);setEditing(true);}}>수정</button></>:<form onSubmit={async e=>{e.preventDefault();if(await send('save_thought',{taskId:task.id,date:day,body}))setEditing(false);}}><label>이 할 일을 하며 떠오른 생각<textarea className="record-input" required maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label><div className="actions">{editing&&<button type="button" className="text-button" onClick={()=>setEditing(false)}>취소</button>}<button disabled={locked} type="submit">단상 저장</button></div></form>}</details>;
}
export function ReflectionEditor({day,saved,onSaved,onCancel,closing=false}:{day:string;saved?:Reflection;onSaved:()=>void;onCancel?:()=>void;closing?:boolean}){
 const {data,locked,send}=useJournal();const [body,setBody]=useState(saved?.body||''),[imports,setImports]=useState<{id:string;body:string}[]>(saved?.imported_thoughts||[]);
 const available=(data?.thoughts.filter(t=>t.local_date===day&&!imports.some(i=>i.id===t.id)))||[];
 function add(t:Thought){if(body.length+t.body.length+2>4000)return;setBody(body?body+'\n\n'+t.body:t.body);setImports([...imports,{id:t.id,body:t.body}]);}
 return <form className="reflection-editor" onSubmit={async e=>{e.preventDefault();if(await send(closing?'close_day':'save_reflection',{date:day,body,imports}))onSaved();}}><label>오늘은 어떤 하루였나요?<textarea className="record-input" required={!closing} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)} placeholder="기억하고 싶은 순간이나 마음에 남은 생각을 적어 주세요. 회고를 작성하지 않아도 하루를 마무리할 수 있습니다."/></label>
 <details><summary>이 날짜의 단상 가져오기</summary>{available.map(t=><article key={t.id}><p className="record-body">{t.body}</p><button type="button" className="text-button" disabled={body.length+t.body.length+2>4000} onClick={()=>add(t)}>가져오기</button></article>)}{!available.length&&<p className="field-help">가져올 새 단상이 없습니다.</p>}</details>
 <div className="actions">{onCancel&&<button type="button" className="text-button" onClick={onCancel}>취소</button>}<button className="primary" disabled={locked} type="submit">{closing?'마무리하기':'회고 저장'}</button></div></form>;
}
export function DayClosing({day}:{day:string}){
 const {data}=useJournal();const [stage,setStage]=useState<'closed'|'idle'|'tasks'|'write'>('idle');
 const saved=data?.reflections.find(r=>r.local_date===day),unfinished=data?.tasks.filter(t=>!t.complete&&t.due_date===day)||[];
 return <section className="day-closing"><h3>하루 마무리</h3><p className="field-help">단상을 확인하고 회고를 작성할 수 있습니다.</p>{stage==='idle'&&<button disabled={!data} onClick={()=>setStage('tasks')}>오늘 마무리</button>}
 {stage==='tasks'&&<><h4>오늘 마감인 미완료 할 일 {unfinished.length}개</h4><ul>{unfinished.map(t=><li className="task-title" key={t.id}>{t.title}</li>)}</ul><div className="actions"><button onClick={()=>setStage('write')}>회고 작성</button></div></>}
 {stage==='write'&&<ReflectionEditor day={day} saved={saved} closing onSaved={()=>setStage('closed')}/>}
 {stage==='closed'&&<p role="status">하루를 마무리했습니다.{saved?' 회고는 보관함에서 확인할 수 있습니다.':''}</p>}</section>;
}
function ReflectionCard({value,onDay}:{value:Reflection;onDay:(day:string)=>void}){
 const {locked,send}=useJournal();const [editing,setEditing]=useState(false),[menu,setMenu]=useState(false);
 return <article className="reflection-card"><div className="section-heading"><button className="text-button reflection-date" onClick={()=>onDay(value.local_date)}>{value.local_date.replaceAll('-','.')}</button><div className="reflection-tools"><Bookmark active={value.bookmarked} disabled={locked} onClick={()=>void send('bookmark_reflection',{reflectionId:value.id,bookmarked:!value.bookmarked})}/><div className="action-menu"><button className="text-button" aria-label="회고 수정·삭제" aria-expanded={menu} onClick={()=>setMenu(!menu)}>⋯</button>{menu&&<div className="menu-items"><button onClick={()=>{setMenu(false);setEditing(true);}}>수정</button><button disabled={locked} onClick={()=>{if(window.confirm('이 회고를 휴지통으로 옮길까요?'))void send('delete_entity',{entityType:'reflection',entityId:value.id,at:new Date().toISOString()});setMenu(false);}}>삭제</button></div>}</div></div></div>
 {editing?<ReflectionEditor day={value.local_date} saved={value} onSaved={()=>setEditing(false)} onCancel={()=>setEditing(false)}/>:<p className="record-body">{value.body}</p>}</article>;
}
export function Archive({onDay}:{onDay:(day:string)=>void}){
 const {data,locked,send}=useJournal();const [tab,setTab]=useState<'reflections'|'trash'>('reflections'),[bookmarks,setBookmarks]=useState(false),[date,setDate]=useState(''),[query,setQuery]=useState('');
 const reflections=data?.reflections.filter(r=>(!bookmarks||r.bookmarked)&&(!date||r.local_date===date)&&(!query||r.body.toLocaleLowerCase('ko').includes(query.toLocaleLowerCase('ko'))))||[];
 return <><div className="page-title"><div><small>ARCHIVE</small><h2>보관함</h2></div></div><nav className="view-tabs" aria-label="보관함 메뉴"><button aria-pressed={tab==='reflections'} onClick={()=>setTab('reflections')}>회고 모음</button><button aria-pressed={tab==='trash'} onClick={()=>setTab('trash')}>휴지통</button></nav>
 {tab==='reflections'&&<><div className="archive-search"><DateField label="날짜" value={date} onChange={setDate}/><label>검색<input type="search" placeholder="회고 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="bookmark-button" aria-label="책갈피한 회고만 보기" aria-pressed={bookmarks} onClick={()=>setBookmarks(!bookmarks)}><svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true"><path d="M5 4h14v21l-7-5-7 5Z" fill={bookmarks?'currentColor':'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg></button></div>
 {reflections.map(r=><ReflectionCard key={r.id} value={r} onDay={onDay}/>)}{!reflections.length&&<p className="empty">{data?'표시할 회고가 없습니다.':'저장소 연결 후 회고를 확인할 수 있습니다.'}</p>}</>}
 {tab==='trash'&&<><p className="field-help">삭제한 기록을 복원할 수 있습니다. 자동으로 완전히 삭제하지 않습니다.</p>{data?.trash.map(t=><article className="trash-row" key={t.id}><div><h3>{t.title}</h3><p className="field-help">{({plan:'계획',task:'할 일',run:'실행 기록',placement:'계획 배치',reflection:'회고'})[t.entity_type]} · {t.deleted_at.slice(0,10)} 삭제</p></div><button disabled={locked} onClick={()=>void send('restore_entity',{trashId:t.id})}>복원</button></article>)}{!data?.trash.length&&<p className="empty">휴지통이 비어 있습니다.</p>}</>}
 </>;
}
