'use client';
import {useState} from 'react';
import {authClient} from '@/lib/auth-client';
import {newPasswordError} from '@/lib/password-policy';
import {passwordResetFeedback} from '@/lib/auth-feedback';

/** Signed-in password change. Email recovery remains a separate flow. */
export function PasswordChange({onClose,onChanged}:{onClose:()=>void;onChanged:(message:string)=>void}){
 const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const issue=password?(newPasswordError(password)||(new TextEncoder().encode(password).length>72?'UTF-8 기준 72바이트 이내로 입력해 주세요.':null)):null;
 const mismatch=confirm.length>0&&password!==confirm;
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy||!current||!password||issue||password!==confirm)return;
  if(current===password){setMessage('현재 비밀번호와 다르게 입력해 주세요.');return;}
  setBusy(true);setMessage('');
  let updated=false;
  try{
   const api=authClient();
   const {data:{user},error:identityError}=await api.auth.getUser();
   if(identityError||!user?.email){setMessage('로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.');return;}
   const {data,error}=await api.auth.signInWithPassword({email:user.email,password:current});
   setCurrent('');
   if(error||data.user?.id!==user.id){setMessage('현재 비밀번호를 확인해 주세요.');return;}
   const {error:changeError}=await api.auth.updateUser({password});
   if(changeError){const feedback=passwordResetFeedback(changeError);setMessage(feedback.restart?'본인 확인 상태가 유효하지 않습니다. 현재 비밀번호를 다시 입력해 주세요.':feedback.message);return;}
   updated=true;setPassword('');setConfirm('');
   const {error:logoutError}=await api.auth.signOut({scope:'global'});
   onChanged(logoutError?'비밀번호는 변경됐습니다. 로그인 상태 종료를 확인하지 못했으므로 새 비밀번호로 다시 로그인해 주세요.':'비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해 주세요.');
  }catch{
   if(updated)onChanged('비밀번호는 변경됐습니다. 연결이 끊겨 로그인 상태 종료를 확인하지 못했습니다. 새 비밀번호로 다시 로그인해 주세요.');
   else setMessage('요청 결과를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.');
  }finally{setBusy(false);}
 }
 return <section className="account-panel" aria-labelledby="password-change-title"><div className="account-actions"><h2 id="password-change-title">비밀번호 변경</h2><button onClick={onClose} disabled={busy}>닫기</button></div><p>현재 비밀번호를 확인한 뒤 변경합니다. 변경 후에는 새 비밀번호로 다시 로그인해야 합니다.</p><form onSubmit={submit}>
 <label className="auth-field">현재 비밀번호<input type="password" autoComplete="current-password" required disabled={busy} value={current} onChange={e=>setCurrent(e.target.value)}/></label>
 <label className="auth-field">새 비밀번호<input type="password" autoComplete="new-password" required disabled={busy} value={password} onChange={e=>setPassword(e.target.value)} aria-invalid={!!issue} aria-describedby="change-password-help"/></label>
 <p id="change-password-help" className="auth-help">8자 이상 · 공백 제외 · 한글과 붙여넣기 허용<br/>대소문자·특수문자 조합은 필수가 아닙니다.</p>
 {issue&&<p className="auth-help auth-input-error" role="status">{issue}</p>}
 <label className="auth-field">새 비밀번호 확인<input type="password" autoComplete="new-password" required disabled={busy} value={confirm} onChange={e=>setConfirm(e.target.value)} aria-invalid={mismatch} aria-describedby={confirm?'change-password-match':undefined}/></label>
 {confirm&&<p id="change-password-match" className={'auth-help'+(mismatch?' auth-input-error':'')} role="status">{mismatch?'새 비밀번호와 일치하지 않습니다.':'새 비밀번호와 일치합니다.'}</p>}
 {message&&<p className="auth-feedback" role="alert">{message}</p>}
 <button className="auth-primary" disabled={busy||!current||!password||!confirm||!!issue||mismatch}>{busy?'변경 중…':'비밀번호 변경'}</button></form></section>;
}
