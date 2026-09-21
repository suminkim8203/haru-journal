'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {Command,Snapshot} from '@/lib/contracts';
import {snapshot,execute,StorageError} from '@/lib/storage';
type Result={entityId:string|null;revision:number};
type Store={saveError:string;data:Snapshot|null;locked:boolean;blocked:boolean;send:(command:Command['command'],payload:Record<string,unknown>)=>Promise<Result|null>};
const Context=createContext<Store|null>(null);
export function useJournal(){const value=useContext(Context);if(!value)throw Error('Journal provider missing');return value;}
export function JournalProvider({initial,issue,children}:{initial:Snapshot|null;issue:string|null;children:ReactNode}){
 const [data,setData]=useState(initial),[error,setError]=useState(issue||''),[message,setMessage]=useState('');
 const [busy,setBusy]=useState(false),[conflict,setConflict]=useState(false),[uncertain,setUncertain]=useState(false);
 useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(timer);},[message]);
 const inFlight=useRef(false),pending=useRef<{signature:string;envelope:Command;payload:Record<string,unknown>}|null>(null);
 async function refresh(){const value=await snapshot();setData(value);return value;}
 useEffect(()=>{let active=true;snapshot().then(value=>{if(active){setData(value);setError('');}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Supabase에 연결하지 못했습니다.');});return()=>{active=false;};},[]);
 async function send(command:Command['command'],payload:Record<string,unknown>):Promise<Result|null>{
  if(!data||inFlight.current||conflict)return null;
  const signature=JSON.stringify({command,payload});
  if(pending.current&&pending.current.signature!==signature){setError('이전 저장 결과를 먼저 확인해 주세요. 입력한 내용은 유지됩니다.');return null;}
  inFlight.current=true;setBusy(true);setError('');setMessage('');
  const frozenPayload=command==='set_task_complete'&&payload.complete&&!payload.at?{...payload,at:new Date().toISOString()}:payload;
  const envelope=pending.current?.envelope||{requestId:crypto.randomUUID(),expectedRevision:data.revision,command,payload:frozenPayload};
  pending.current={signature,envelope,payload};let result:Result|null=null;
  const previousComplete=data.tasks.find(t=>t.id===payload.taskId)?.complete;
  if(command==='set_task_complete')setData(old=>old?{...old,tasks:old.tasks.map(t=>t.id===payload.taskId?{...t,complete:!!payload.complete}:t)}:old);
  try{
   let value:Result;try{value=await execute(envelope)}catch(e){if(e instanceof StorageError){if(e.status===409){pending.current=null;setConflict(true);}else if(e.status<500)pending.current=null;}throw e;}
   result=value;pending.current=null;setUncertain(false);
   // Patch the same React tree; never replace the page or reset detail/editor state.
   setData(old=>old?{...old,revision:value.revision}:old);await refresh();setMessage(command==='bookmark_reflection'?(payload.bookmarked?'책갈피에 저장했습니다.':'책갈피를 해제했습니다.'):'저장했습니다.');return result;
  }catch(e){if(!result&&command==='set_task_complete'&&previousComplete!==undefined)setData(old=>old?{...old,tasks:old.tasks.map(t=>t.id===payload.taskId?{...t,complete:previousComplete}:t)}:old);setError(result?'저장은 완료됐지만 화면을 불러오지 못했습니다. 최신 자료 확인을 눌러 주세요.':e instanceof Error?e.message:'연결을 확인해 주세요.');if(result)setConflict(true);else setUncertain(!!pending.current);return result;}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function reload(){if(inFlight.current)return;inFlight.current=true;setBusy(true);try{await refresh();setConflict(false);setError('');setMessage('최신 자료를 불러왔습니다. 입력한 내용은 유지됩니다.');}catch(e){setError(e instanceof Error?e.message:'연결을 확인해 주세요.');}finally{inFlight.current=false;setBusy(false);}}
 return <Context.Provider value={{saveError:error,data,locked:busy||conflict||uncertain,blocked:conflict||uncertain,send}}>
  {error&&<div className="notice" role="alert">{error}<button disabled={busy} onClick={reload}>최신 자료 확인</button>{uncertain&&<button disabled={busy||conflict} onClick={()=>{const p=pending.current;if(p)void send(p.envelope.command,p.payload);}}>이전 저장 결과 확인</button>}</div>}
  <p className="save-status" role="status">{message}</p>{children}
 </Context.Provider>;
}
