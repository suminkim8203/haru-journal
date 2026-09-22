'use client';
import {useState} from 'react';
import {authClient} from '@/lib/auth-client';
import {exportDiary} from '@/lib/storage';
export type DeletionStatus={state:'active'|'pending'|'expired';deleteAfter?:string};
export const deletionDate=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'long',timeStyle:'short'}).format(new Date(value));
export function DeletionPending({status,onCancel,onLogout}:{status:DeletionStatus;onCancel:()=>Promise<void>;onLogout:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function cancel(){setBusy(true);setError('');try{const {error}=await authClient().rpc('haru_cancel_deletion');if(error)throw error;await onCancel();}catch{setError('탈퇴를 취소하지 못했습니다. 삭제 예정 시각이 지났거나 연결을 확인해야 합니다.');}finally{setBusy(false);}}
 return <section className="account-panel"><h2>{status.state==='expired'?'탈퇴 취소 기간이 지났습니다.':'탈퇴가 신청되었습니다.'}</h2><p>삭제 예정: {status.deleteAfter&&deletionDate(status.deleteAfter)} (한국 시간)</p><p>{status.state==='expired'?'계정과 기록의 삭제 처리를 진행합니다. 기록을 열거나 탈퇴를 취소할 수 없습니다.':'7일의 유예기간 안에 직접 취소하면 기록을 다시 사용할 수 있습니다. 로그인만으로는 취소되지 않습니다.'}</p>{error&&<p role="alert">{error}</p>}<div className="account-actions">{status.state==='pending'&&<button disabled={busy} onClick={cancel}>{busy?'처리 중…':'탈퇴 취소'}</button>}<button disabled={busy} onClick={onLogout}>로그아웃</button></div></section>;
}
export function AccountDeletion({onClose,onRequested}:{onClose:()=>void;onRequested:(status:DeletionStatus)=>void}){
 const [password,setPassword]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function download(){setBusy(true);setMessage('');try{const data=await exportDiary();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='haru-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{setMessage('내보내지 못했습니다. 잠시 후 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function submit(e:React.FormEvent){e.preventDefault();if(busy||!confirmed)return;setBusy(true);setMessage('');try{
 const api=authClient();const {data:{user},error:userError}=await api.auth.getUser();if(userError||!user?.email)throw new Error('로그인 상태를 확인해 주세요.');
 const {data,error}=await api.auth.signInWithPassword({email:user.email,password});setPassword('');
 if(error||data.user?.id!==user.id)throw new Error('현재 비밀번호를 확인해 주세요.');
 const {data:status,error:requestError}=await api.rpc('haru_request_deletion');
 if(requestError)throw new Error(requestError.code==='PT409'?'진행 중인 기록을 종료한 뒤 탈퇴를 신청해 주세요.':'탈퇴 신청을 확인하지 못했습니다. 다시 시도해 주세요.');
 await api.auth.signOut({scope:'local'});onRequested(status as DeletionStatus);
 }catch(e){setMessage(e instanceof Error?e.message:'탈퇴를 신청하지 못했습니다.');}finally{setBusy(false);}}
 return <section className="account-panel"><div className="account-actions"><h2>계정 탈퇴</h2><button onClick={onClose} disabled={busy} aria-label="탈퇴 화면 닫기">닫기</button></div><p>신청 즉시 모든 기기에서 로그아웃되며 기록 접근이 중단됩니다. 7일 안에 다시 로그인해 탈퇴를 취소할 수 있습니다.</p><p>7일 후 계정과 계획·할 일·실행 기록·단상·회고를 삭제하며 복구할 수 없습니다. 필요한 기록은 먼저 내려받으세요.</p><button onClick={download} disabled={busy}>내 기록 내보내기</button><p className="auth-help">별도로 보관된 재해 복구용 백업은 계정 복구에 사용하지 않습니다. 백업 사본의 삭제 일정은 운영 정책에 따라 별도로 안내합니다.</p><form onSubmit={submit}><label className="auth-field">현재 비밀번호<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label><label className="account-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/>7일 이후 계정과 기록이 삭제되는 것을 확인했습니다.</label>{message&&<p role="alert" className="auth-feedback">{message}</p>}<button className="auth-primary" disabled={busy||!confirmed||!password}>{busy?'처리 중…':'탈퇴 신청'}</button></form></section>;
}
