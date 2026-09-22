type Failure={code?:string;name?:string};
export function passwordResetFeedback(error:Failure){
 if(error.code==='same_password')return {restart:false,message:'이전에 사용한 비밀번호와 같습니다. 다른 새 비밀번호를 입력해 주세요.'};
 if(error.code==='weak_password')return {restart:false,message:'새 비밀번호가 보안 조건을 충족하지 않습니다. 다른 비밀번호를 입력해 주세요.'};
 if(error.code==='validation_failed')return {restart:false,message:'새 비밀번호의 입력 조건을 확인해 주세요.'};
 if(['session_expired','session_not_found','refresh_token_not_found','refresh_token_already_used','bad_jwt','no_authorization','reauthentication_needed','reauthentication_not_valid'].includes(error.code||'')||error.name==='AuthSessionMissingError')return {restart:true,message:'본인 확인 상태가 만료됐거나 유효하지 않습니다. 이메일 인증을 다시 진행해 주세요.'};
 if(error.code==='over_request_rate_limit')return {restart:false,message:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'};
 return {restart:false,message:'비밀번호 변경을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'};
}
