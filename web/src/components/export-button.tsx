'use client';
import {useState} from 'react';
import {exportDiary} from '@/lib/storage';
export function ExportButton(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(){if(busy)return;setBusy(true);setError('');try{
  const data=await exportDiary(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='HaruLeaf-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setError(e instanceof Error?e.message:'자료를 내보내지 못했습니다.')}finally{setBusy(false)}}
 return <div className="export-row"><button disabled={busy} onClick={download}>{busy?'자료 준비 중…':'자료 내보내기'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
