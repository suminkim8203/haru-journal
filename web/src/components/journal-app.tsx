'use client';
import {useEffect,useState} from 'react';
import type {Snapshot} from '@/lib/contracts';
import {seoulDate} from '@/lib/schedule';
import {JournalProvider} from './journal-provider';
import {Plans} from './plans';
import {Schedule} from './schedule';
import {Archive} from './records';
import {Review} from './review';
import {ExportButton} from './export-button';
import {UsageGuide} from './usage-guide';
import {RecordingPanel} from './recording-panel';
import {privateJournalEnabled} from '@/lib/auth-mode';
export function JournalApp({initial,issue}:{initial:Snapshot|null;issue:string|null}){
 const [page,setPage]=useState<'plans'|'schedule'|'review'|'archive'>('schedule'),[day,setDay]=useState(seoulDate()),[selectedId,setSelectedId]=useState(''),[openRequest,setOpenRequest]=useState(0),[now,setNow]=useState<number|null>(null),[editTask,setEditTask]=useState(''),[scheduleView,setScheduleView]=useState('daily'),[openPlan,setOpenPlan]=useState(''),[planRequest,setPlanRequest]=useState(0);
 useEffect(()=>{const update=()=>setNow(Date.now());update();const interval=setInterval(update,1000);document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);};},[]);
 function openDay(d:string,id=''){setDay(d);setSelectedId(id);setOpenRequest(n=>n+1);setPage('schedule');}
 return <JournalProvider initial={initial} issue={issue}>
  <nav aria-label="주요 메뉴">{([['schedule','일정'],['plans','계획'],['review','돌아보기'],['archive','보관함']] as const).map(([id,text])=><button key={id} className="navbtn" data-typo-role="menu" aria-current={page===id?'page':undefined} onClick={()=>setPage(id)}><span data-typo-role="menu">{text}</span></button>)}<UsageGuide/>{privateJournalEnabled&&<a className="account-nav-link" href="/account.html">계정</a>}</nav>
  <main className="main" id="app" tabIndex={-1}>
   <div hidden={page!=='plans'}><Plans openPlan={openPlan} planRequest={planRequest} editRequest={editTask} onEditHandled={()=>setEditTask('')}/></div>
   <div hidden={page!=='schedule'}><Schedule onViewChange={setScheduleView} openRequest={openRequest} day={day} setDay={setDay} selectedId={selectedId} setSelectedId={setSelectedId} now={now??Date.parse(day+'T00:00:00+09:00')} onPlan={()=>setPage('plans')} onEditTask={id=>{setEditTask(id);setPage('plans');}} onArchive={()=>setPage('archive')}/></div>
   <div hidden={page!=='review'}><Review now={now??Date.parse(day+'T00:00:00+09:00')} onDay={openDay} onPlan={id=>{setOpenPlan(id||'');setPlanRequest(n=>n+1);setPage('plans');}}/></div>
   <div hidden={page!=='archive'}><Archive onDay={openDay}/></div>
   {!privateJournalEnabled&&<div className="export-tools"><ExportButton/></div>}
  </main>
  {now!==null&&<RecordingPanel visible={page!=='schedule'||day!==seoulDate(now)||scheduleView!=='daily'} now={now} onOpen={id=>openDay(seoulDate(now),id)}/>} 
 </JournalProvider>;
}
