import type {Plan,Snapshot,Task} from '@/lib/contracts';
import {JournalApp} from '@/components/journal-app';
import {EditionDate} from '@/components/edition-date';
import {PreviewChoiceProvider} from '@/components/choice-select';
import './study.css';

const at=(day:string,time:string)=>new Date(`${day}T${time}:00+09:00`).toISOString();
const plan=(id:string,title:string,start:string,end:string,marker:Plan['marker_color']='blue'):Plan=>({id,title,kind:'general',start_date:start,end_date:end,marker_color:marker,closed_at:null,success_text:'계획한 일을 실행하고 기록을 확인한다.',estimated_minutes:120,priority:'normal',history:[]});
const task=(id:string,planId:string,title:string,complete=false,completedAt:string|null=null):Task=>({id,plan_id:planId,title,description:'',due_date:null,estimated_minutes:40,priority:'normal',complete,completed_at:completedAt,tags:[]});
const sample:Snapshot={schemaVersion:6,diaryId:'preview-only',timezone:'Asia/Seoul',revision:1,routines:[],retainedTasks:[],
 plans:[plan('p1','Haru 화면 사용성 정리','2026-09-28','2026-10-03','blue'),plan('p2','단상·회고 기능 점검','2026-09-17','2026-09-24','mint'),plan('p3','부산 여행','2026-09-23','2026-09-24','warm'),plan('p4','부산 여행 종이 다이어리 꾸미기','2026-09-25','2026-09-25','violet')],
 tasks:[task('t1','p1','일간 화면 배치 검토하기'),task('t2','p1','계획 목록 정리',true,at('2026-09-29','11:30')),task('t3','p1','디자인 시안 확인'),task('t4','p2','단상·회고 기능 사용 확인'),task('t5','p3','숙소 체크인',true,at('2026-09-29','09:10')),task('t6','p3','흰여울마을 구경',true,at('2026-09-29','09:20')),task('t7','p3','거인 돈까스 식사',true,at('2026-09-29','09:25')),task('t8','p3','카페에서 쉬기',true,at('2026-09-29','09:30')),task('t9','p3','텍스트 쇼핑 클럽 전시',true,at('2026-09-29','09:35')),task('t10','p3','부산역에서 낙곱새 먹기',true,at('2026-09-29','09:40')),task('t11','p4','부산 여행 종이 다이어리 꾸미기',true,at('2026-09-29','11:00'))],
 placements:[{id:'b1',task_id:'t1',started_at:at('2026-09-29','14:00'),ended_at:at('2026-09-29','15:00')}],
 runs:[{id:'r1',task_id:'t2',started_at:at('2026-09-29','10:55'),ended_at:at('2026-09-29','11:30'),source:'manual',blocked_reason:'',work_seconds:2100,segments:[{id:'s1',kind:'work',started_at:at('2026-09-29','10:55'),ended_at:at('2026-09-29','11:30')}]}],
 thoughts:[],reflections:[{id:'f1',local_date:'2026-09-28',body:'날짜와 할 일의 관계를 다시 살폈다. 필요한 정보가 서로 다른 화면에 흩어져 있어 이동이 길었다.',bookmarked:true,imported_thoughts:[]},{id:'f2',local_date:'2026-09-25',body:'부산에서 돌아온 뒤 여행의 장면을 종이 다이어리에 남겼다. 사진과 짧은 문장으로 그날의 순서를 정리했다.',bookmarked:false,imported_thoughts:[]}],
 closures:[],improvements:[],trash:[]};

export default function StudyPage(){return <div className="paper study-page">
 <div className="prototype-bar"><div className="prototype-label"><strong className="prototype-number">화면 동선 검토 04</strong><span className="detail">현재 서비스 코드·서체·아이콘 재사용 · 저장되지 않는 데스크톱 시안</span></div></div>
 <header className="masthead"><div className="mast-meta" data-typo-role="info"><span aria-hidden="true"/><EditionDate/></div><div className="mast-title"><div className="mast-brand"><h1 lang="en" className="haru-masthead" data-typo-role="brand">Haru<span>Leaf</span></h1><div className="edition" data-typo-role="info">PLAN · DO · SEE JOURNAL</div></div></div></header>
 <PreviewChoiceProvider><JournalApp initial={sample} issue={null} preview/></PreviewChoiceProvider>
 <footer className="footer" data-typo-role="info"><span>기록을 평가하지 않고, 계획과 실제를 나란히 봅니다.</span><span>Haru</span></footer>
 </div>}
