declare const Deno: {env:{get(name:string):string|undefined};serve(handler:(req:Request)=>Promise<Response>):unknown};
import {requestPolicy} from './policy.ts';
// Installed behind the /auth/v1 route. Native Auth must have no public bypass.
const internal=Deno.env.get('HARU_AUTH_INTERNAL_URL')||'http://auth:9999';
const rest=Deno.env.get('HARU_REST_INTERNAL_URL')||'http://rest:3000';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowed=new Set(['signup','recover','resend','verify','token','user','logout','settings','health']);
const methods:Record<string,string[]>={signup:['POST'],recover:['POST'],resend:['POST'],verify:['POST'],token:['POST'],user:['GET','PUT'],logout:['POST'],settings:['GET'],health:['GET']};
Deno.serve(async(req:Request)=>{
 const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
 const fail=(status:number,code:string,msg:string)=>new Response(JSON.stringify({code,msg}),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!internal||!rest||!serviceKey)return fail(503,'auth_unavailable','인증 연결을 확인하지 못했습니다.');
 try{
  const url=new URL(req.url),path=url.pathname.split('/').filter(Boolean).pop()||'';
  if(!allowed.has(path)||!methods[path].includes(req.method))return fail(404,'not_found','요청을 찾을 수 없습니다.');
  if(path==='token'&&!['password','refresh_token'].includes(url.searchParams.get('grant_type')||''))return fail(400,'validation_failed','지원하지 않는 로그인 방식입니다.');
  const raw=req.method==='GET'?'':await req.text();
  if(raw.length>16384)return fail(413,'validation_failed','입력 내용이 너무 깁니다.');
  let body:Record<string,unknown>={};
  if(raw){body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))return fail(400,'validation_failed','입력을 확인해 주세요.');}
  const policy=requestPolicy(path,req.method,body);
  if(policy.error)return fail(422,'validation_failed',policy.error);
  let subject='';
  if(policy.action){
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(policy.purpose+':'+policy.email));
   subject=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
   const count=await fetch(rest+'/rpc/haru_auth_attempt',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+serviceKey},body:JSON.stringify({p_subject:subject,p_action:policy.action}),signal:AbortSignal.timeout(5000)});
   if(!count.ok)return fail(503,'auth_unavailable','인증 요청을 확인하지 못했습니다.');
   if(await count.json()!==true)return fail(429,'over_request_rate_limit','인증 시도 횟수를 초과했습니다. 10분 뒤 새 번호를 요청해 주세요.');
  }
  const forwarded=new Headers({'content-type':'application/json'});
  for(const name of ['authorization','x-client-info']){const value=req.headers.get(name);if(value)forwarded.set(name,value);}
  // No request/response logging. Upstream still verifies password, token and purpose.
  const result=await fetch(internal+'/'+path+url.search,{method:req.method,headers:forwarded,body:raw||undefined,redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(policy.action==='verify'&&result.ok){
   const cleared=await fetch(rest+'/rpc/haru_auth_attempt',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+serviceKey},body:JSON.stringify({p_subject:subject,p_action:'success'}),signal:AbortSignal.timeout(5000)});
   // Failure to clear is conservative: retain the remaining attempt restriction.
   if(!cleared.ok){ /* no credentials or response bodies in logs */ }
  }
  return new Response(result.body,{status:result.status,headers:{...headers,'content-type':result.headers.get('content-type')||'application/json'}});
 }catch{return fail(503,'auth_unavailable','인증 요청을 처리하지 못했습니다. 다시 시도해 주세요.');}
});
