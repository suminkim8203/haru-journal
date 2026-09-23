'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {authClient} from '@/lib/auth-client';
import {clearAccountDiary,prepareAccount} from '@/lib/storage';
import {AuthForm} from './auth-form';
import {JournalApp} from './journal-app';
import {AccountHome} from './account-home';
import {AccountDeletion,DeletionPending,type DeletionStatus,deletionDate} from './account-deletion';

export function PrivateJournal({screen='journal'}:{screen?:'journal'|'account'|'deletion'}){
 const [account,setAccount]=useState(''),[checking,setChecking]=useState(true),[message,setMessage]=useState('');
 const [deletion,setDeletion]=useState<DeletionStatus|null>(null);
 const [withdrawalDone,setWithdrawalDone]=useState('');
 const generation=useRef(0),user=useRef('');
 const lock=useCallback(()=>{generation.current++;user.current='';clearAccountDiary();setAccount('');setDeletion(null);setChecking(false);},[]);
 const enter=useCallback(async()=>{
  const ticket=++generation.current;clearAccountDiary();setAccount('');setChecking(true);setMessage('');setDeletion(null);
  try{const {data:{session}}=await authClient().auth.getSession();if(!session)return;user.current=session.user.id;
   const {data:status,error:statusError}=await authClient().rpc('haru_account_status');if(statusError)throw statusError;
   if(ticket!==generation.current)return;
   if(status?.state==='pending'||status?.state==='expired'){setDeletion(status);return;}
   if(status?.state!=='active')throw new Error('Invalid account state');
   const diary=await prepareAccount();if(ticket===generation.current)setAccount(session.user.id+':'+diary);
  }catch{if(ticket===generation.current)setMessage('개인 자료 연결을 확인하지 못했습니다. 다시 로그인해 주세요.');}
  finally{if(ticket===generation.current)setChecking(false);}
 },[]);
 useEffect(()=>{
  void enter();
  const {data:{subscription}}=authClient().auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'||event==='PASSWORD_RECOVERY'||(event==='SIGNED_IN'&&user.current&&session?.user.id!==user.current))lock();
  });
  const expired=()=>{lock();setMessage('로그인 상태가 만료됐거나 유효하지 않습니다. 다시 로그인해 주세요.');};
  window.addEventListener('haru-auth-required',expired);
  return()=>{generation.current++;subscription.unsubscribe();window.removeEventListener('haru-auth-required',expired);clearAccountDiary();};
 },[enter,lock]);
 async function logout(){setMessage('');try{const {error}=await authClient().auth.signOut({scope:'local'});if(error)throw error;lock();if(screen!=='journal')window.location.assign('/');}catch{setMessage('로그아웃을 확인하지 못했습니다. 다시 시도해 주세요.');}}
 function requested(status:DeletionStatus){lock();setWithdrawalDone(status.deleteAfter ? `탈퇴가 신청되었습니다. ${deletionDate(status.deleteAfter)}까지 다시 로그인해 취소할 수 있습니다.` : '탈퇴 신청을 확인했습니다.');}
 if(checking)return <p className="auth-check-notice" role="status">로그인 상태를 확인하고 있습니다.</p>;
 if(withdrawalDone)return <main className="account-page" role="status"><h1>탈퇴 신청 완료</h1><p>{withdrawalDone}</p><a href="/">로그인 화면으로</a></main>;
 if(deletion)return <DeletionPending status={deletion} onCancel={async()=>{await enter();window.location.assign('/');}} onLogout={logout}/>;
 if(!account)return <>{message&&<p className="auth-feedback" role="status">{message}</p>}<AuthForm onSignedIn={async()=>{await enter();if(screen==='deletion')window.location.assign('/account.html');}}/></>;
 if(screen==='account')return <>{message&&<p className="auth-feedback" role="status">{message}</p>}<AccountHome onLogout={logout}/></>;
 if(screen==='deletion')return <main className="account-page"><a className="account-return" href="/account.html">계정</a><AccountDeletion onClose={()=>window.location.assign('/account.html')} onRequested={requested}/></main>;
 return <JournalApp key={account} initial={null} issue={null}/>;
}
