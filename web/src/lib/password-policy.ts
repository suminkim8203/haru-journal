/** New-password policy only. Never normalize a credential or log its value. */
export function newPasswordError(value:string):string|null {
 if (/\s/u.test(value)) return '비밀번호에는 공백을 사용할 수 없습니다.';
 if ([...value].length < 8) return '비밀번호를 8자 이상 입력해 주세요.';
 return null;
}
