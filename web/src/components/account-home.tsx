'use client';
import {useState} from 'react';
import {exportDiary} from '@/lib/storage';

export function AccountHome({onLogout}:{onLogout:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function download(){
  setBusy(true);setMessage('');
  try{
   const data=await exportDiary();
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='haru-records.json';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch{setMessage('기록을 내려받지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');}
  finally{setBusy(false);}
 }
 return <main className="account-page" id="app" tabIndex={-1}>
  <a className="account-return" href="/">일정</a>
  <h1>계정</h1>
  <p className="account-intro">내 기록과 계정의 사용을 관리합니다.</p>
  <section className="account-item"><div><h2>내 기록 내보내기</h2><p>계획부터 회고까지 내 자료를 파일 하나로 내려받습니다.</p></div><button onClick={download} disabled={busy}>{busy?'준비 중…':'내보내기'}</button></section>
  <section className="account-item"><div><h2>로그아웃</h2><p>이 기기의 로그인 상태를 종료합니다.</p></div><button onClick={onLogout} disabled={busy}>로그아웃</button></section>
  <section className="account-item account-danger"><div><h2>계정 탈퇴</h2><p>신청 후 7일 동안 취소할 수 있습니다. 기한이 지나면 계정과 기록을 삭제합니다.</p></div><a href="/account/deletion.html">탈퇴 안내 보기</a></section>
  {message&&<p className="auth-feedback" role="alert">{message}</p>}
 </main>;
}
