import type {Priority} from '@/lib/contracts';
export const priorityText=(p:Priority)=>({high:'높음',normal:'보통',low:'낮음'})[p];
export const dateText=(day:string,long=false)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',...(long?{weekday:'long' as const}:{})}).format(new Date(day+'T12:00:00+09:00'));
export const dateButtonText=(day:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(day+'T12:00:00+09:00'));
