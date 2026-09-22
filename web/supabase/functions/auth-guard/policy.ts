// Shared, side-effect-free policy. Never include credential values in errors.
export function newPasswordIssue(value:unknown):string|null{
 if(typeof value!=='string')return '비밀번호를 입력해 주세요.';
 if(/\s/u.test(value))return '비밀번호에는 공백을 사용할 수 없습니다.';
 if([...value].length<8)return '비밀번호를 8자 이상 입력해 주세요.';
 if(new TextEncoder().encode(value).length>72)return '비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요.';
 return null;
}
export function requestPolicy(path:string,method:string,body:Record<string,unknown>){
 if((path==='signup'&&method==='POST')||(path==='user'&&method==='PUT'&&'password' in body)){
  const error=newPasswordIssue(body.password);if(error)return {error};
 }
 if(path==='verify'){
  if(method!=='POST'||!['signup','recovery'].includes(String(body.type))||typeof body.email!=='string'||typeof body.token!=='string'||!/^\d{6}$/.test(body.token)||'token_hash' in body)return {error:'이메일과 6자리 인증번호를 확인해 주세요.'};
  return {action:'verify',purpose:String(body.type),email:body.email.trim().toLowerCase()};
 }
 if(path==='signup'||path==='recover'||path==='resend'){
  if(method!=='POST'||typeof body.email!=='string'||(path==='resend'&&body.type!=='signup'))return {error:'이메일을 확인해 주세요.'};
  return {action:'issue',purpose:path==='recover'?'recovery':'signup',email:body.email.trim().toLowerCase()};
 }
 return {};
}
