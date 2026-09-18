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
import {RecordingPanel} from './recording-panel';
export function JournalApp({initial,issue}:{initial:Snapshot|null;issue:string|null}){
 const [page,setPage]=useState<'plans'|'schedule'|'review'|'archive'>('plans'),[day,setDay]=useState(seoulDate()),[selectedId,setSelectedId]=useState(''),[openRequest,setOpenRequest]=useState(0),[now,setNow]=useState<number|null>(null);
 useEffect(()=>{const update=()=>setNow(Date.now());update();const interval=setInterval(update,1000);document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);};},[]);
 return <JournalProvider initial={initial} issue={issue}><nav className="main-nav" aria-label="주요 메뉴"><button aria-pressed={page==='schedule'} onClick={()=>setPage('schedule')}>일정</button><button aria-pressed={page==='plans'} onClick={()=>setPage('plans')}>계획</button><button aria-pressed={page==='review'} onClick={()=>setPage('review')}>돌아보기</button><button aria-pressed={page==='archive'} onClick={()=>setPage('archive')}>보관함</button></nav>
 <div hidden={page!=='plans'}><Plans/></div><div hidden={page!=='schedule'}><Schedule openRequest={openRequest} day={day} setDay={setDay} selectedId={selectedId} setSelectedId={setSelectedId} now={now??Date.parse(day+'T00:00:00+09:00')}/></div>
 <div hidden={page!=='review'}><Review now={now??Date.parse(day+'T00:00:00+09:00')} onDay={(d,id)=>{setDay(d);setSelectedId(id||'');setOpenRequest(n=>n+1);setPage('schedule');}}/></div><div hidden={page!=='archive'}><Archive onDay={d=>{setDay(d);setSelectedId('');setOpenRequest(n=>n+1);setPage('schedule');}}/></div>
 <ExportButton/>
 {now!==null&&<RecordingPanel now={now} onOpen={id=>{setSelectedId(id);setDay(seoulDate(now));setOpenRequest(n=>n+1);setPage('schedule');}}/>}
 </JournalProvider>;
}
