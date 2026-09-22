'use client';
import {useEffect,useState} from 'react';
import {authClient} from '@/lib/auth-client';
import {newPasswordError} from '@/lib/password-policy';
import {passwordResetFeedback} from '@/lib/auth-feedback';
type View='login'|'signup'|'verify'|'recover'|'recovery-code'|'newpass'|'ready';
export function AuthForm({onSignedIn}:{onSignedIn?:()=>Promise<void>}={}){
 const [restartRecovery,setRestartRecovery]=useState(false);
 const [view,setView]=useState<View>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[code,setCode]=useState(''),[shown,setShown]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[sentAt,setSentAt]=useState(0),[now,setNow]=useState(0);
 useEffect(()=>{setNow(Date.now());const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 const confirmationStarted=confirm.length>0;
 const confirmationMismatch=view==='newpass'&&confirmationStarted&&password!==confirm;
 const passwordIssue=(view==='signup'||view==='newpass')&&password.length>0?(newPasswordError(password)||(new TextEncoder().encode(password).length>72?'UTF-8 기준 72바이트 이내로 입력해 주세요.':null)):null;
 const wait=Math.max(0,60-Math.floor((now-sentAt)/1000));
 function go(next:View){setRestartRecovery(false);setPassword('');setConfirm('');setCode('');setShown(false);setMessage('');setView(next)}
 async function submit(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('');
 try{
  const api=authClient();
  if(view==='signup'||view==='newpass'){
   const issue=newPasswordError(password);if(issue){setMessage(issue);return}
   if(new TextEncoder().encode(password).length>72){setMessage('비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요. 한글은 보통 한 글자당 3바이트입니다.');return}
  }
  if(view==='login'){
   const {error}=await api.auth.signInWithPassword({email:email.trim(),password});
   if(error){setMessage('이메일 또는 비밀번호를 확인해 주세요.');return}
   if(onSignedIn){await onSignedIn();}else go('ready');
  }else if(view==='signup'){
   const {error}=await api.auth.signUp({email:email.trim(),password});
   if(error){setMessage('가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도하거나 로그인·비밀번호 재설정을 이용해 주세요.');return}
   setSentAt(Date.now());go('verify');
  }else if(view==='verify'||view==='recovery-code'){
   if(!/^\d{6}$/.test(code)){setMessage('6자리 인증번호를 입력해 주세요.');return}
   const {error}=await api.auth.verifyOtp({email:email.trim(),token:code,type:view==='verify'?'signup':'recovery'});
   if(error){setMessage('인증번호가 올바르지 않거나 만료됐습니다. 다시 확인해 주세요.');return}
   if(view==='verify'){
    const {error:logoutError}=await api.auth.signOut({scope:'local'});if(logoutError){setMessage('인증 상태를 정리하지 못했습니다. 다시 시도해 주세요.');return}
    go('login');setMessage('이메일 확인을 마쳤습니다. 설정한 비밀번호로 로그인해 주세요.');
   }else go('newpass');
  }else if(view==='recover'){
   const {error}=await api.auth.resetPasswordForEmail(email.trim());
   if(error){setMessage('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');return}
   setSentAt(Date.now());go('recovery-code');
  }else if(view==='newpass'){
   if(password!==confirm){setMessage('새 비밀번호가 서로 다릅니다.');return}
   const {error}=await api.auth.updateUser({password});if(error){const feedback=passwordResetFeedback(error);setMessage(feedback.message);setRestartRecovery(feedback.restart);return}
   const {error:logoutError}=await api.auth.signOut({scope:'global'});if(logoutError){setMessage('비밀번호는 변경됐지만 로그인 상태 종료를 확인하지 못했습니다. 다시 로그아웃해 주세요.');return}
   go('login');setMessage('비밀번호를 재설정했습니다. 새 비밀번호로 로그인해 주세요.');
  }
 }catch{setMessage('연결하지 못했습니다. 잠시 후 다시 시도해 주세요.')}finally{setBusy(false)}
 }
 async function resend(){if(wait||busy)return;setBusy(true);try{
 const api=authClient();const result=view==='verify'?await api.auth.resend({type:'signup',email:email.trim()}):await api.auth.resetPasswordForEmail(email.trim());
 if(result.error){setMessage('메일 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');return}
 setSentAt(Date.now());setMessage('메일 안내를 확인해 주세요. 가장 최근에 받은 번호를 입력해 주세요.');
 }catch{setMessage('연결하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}}
 async function logout(){setBusy(true);try{const {error}=await authClient().auth.signOut({scope:'local'});if(error)throw error;go('login');setMessage('로그아웃했습니다.')}catch{setMessage('로그아웃을 확인하지 못했습니다. 다시 시도해 주세요.')}finally{setBusy(false)}}
 const otp=view==='verify'||view==='recovery-code';
 const titles={login:'나의 하루를 이어갑니다.',signup:'나의 기록을 시작하세요.',verify:'이메일을 확인해 주세요.',recover:'비밀번호를 잊으셨나요?','recovery-code':'이메일로 본인을 확인합니다.',newpass:'새 비밀번호 설정',ready:'로그인을 확인했습니다.'};
 const labels={login:'로그인',signup:'계정 만들기',verify:'이메일 확인',recover:'인증번호 받기','recovery-code':'인증하고 계속',newpass:'비밀번호 재설정',ready:''};
 return <section className="auth-layout"><aside className="auth-intro"><small>YOUR DAYS, YOUR WORDS</small><h2>계획과 실제를 나란히,<br/>하루를 기록하세요.</h2><p>해야 할 일부터 하루 끝의 생각까지.<br/>흩어져 있던 기록을 한곳에 남겨 보세요.</p></aside><div className="auth-form"><h2>{titles[view]}</h2><p className="auth-sub">{otp?'입력한 주소로 안내를 받을 수 있다면 인증번호를 보냈습니다.':view==='ready'?'개인 자료 연결 전 인증 기능을 확인하는 화면입니다.':view==='signup'?'이메일 확인 후 Haru를 사용할 수 있습니다.':'나의 기록을 위한 계정입니다.'}</p>
 {view!=='ready'&&<form onSubmit={submit}>
 {['login','signup','recover'].includes(view)&&<label className="auth-field">이메일<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>}
 {['login','signup','newpass'].includes(view)&&<><label className="auth-field">{view==='newpass'?'새 비밀번호':'비밀번호'}<span className="auth-input"><input aria-invalid={passwordIssue?true:undefined} aria-describedby={passwordIssue?'password-issue':undefined} type={shown?'text':'password'} autoComplete={view==='login'?'current-password':'new-password'} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/><button type="button" onClick={()=>setShown(!shown)} aria-pressed={shown}>{shown?'숨기기':'보기'}</button></span></label>{view!=='login'&&<p className="auth-help">8자 이상 · 공백 제외 · 한글 사용 가능<br/>대소문자·특수문자 조합은 필수가 아닙니다.</p>}</>}
 {passwordIssue&&<p id="password-issue" className="auth-help auth-input-error" role="status">{passwordIssue}</p>}
 {view==='newpass'&&<><label className="auth-field">새 비밀번호 확인<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={busy} aria-invalid={confirmationMismatch?true:undefined} aria-describedby={confirmationStarted?'password-confirm-status':undefined}/></label>{confirmationStarted&&<p id="password-confirm-status" className={'auth-help'+(confirmationMismatch?' auth-input-error':'')} role="status">{confirmationMismatch?'새 비밀번호와 일치하지 않습니다.':'새 비밀번호와 일치합니다.'}</p>}</>}
 {otp&&<><p>{email}</p><label className="auth-field">인증번호<input className="auth-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required disabled={busy}/></label><p className="auth-help">메일 발송 후 10분 동안 입력할 수 있습니다.</p></>}
 <button className="auth-primary" disabled={busy||confirmationMismatch||!!passwordIssue}>{busy?'처리 중…':labels[view]}</button></form>}
 {message&&<p className="auth-feedback" role="status">{message}</p>}
 {restartRecovery&&<button type="button" disabled={busy} onClick={()=>go('recover')}>이메일 인증 다시 진행</button>}
 <div className="auth-links">{view==='login'?<><button onClick={()=>go('signup')} disabled={busy}>계정 만들기</button><button onClick={()=>go('recover')} disabled={busy}>비밀번호 재설정</button></>:view==='ready'?<button onClick={logout} disabled={busy}>로그아웃</button>:otp?<><button onClick={resend} disabled={busy||wait>0}>{wait>0?wait+'초 후 다시 받기':'인증번호 다시 받기'}</button><button onClick={()=>go(view==='verify'?'signup':'recover')} disabled={busy}>이메일 다시 입력</button></>:<button onClick={()=>go('login')} disabled={busy}>로그인으로 돌아가기</button>}</div>
 </div></section>
}
