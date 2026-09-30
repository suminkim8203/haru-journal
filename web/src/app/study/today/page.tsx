import {CalendarIcon} from '@/components/icons';
import './today.css';

const weekdays=[['일','27'],['월','28'],['화','29'],['수','30'],['목','1'],['금','2'],['토','3']];
type Variant='inline-current'|'inline-quiet'|'strip-current'|'strip-quiet';

function TodayReturn({quiet}:{quiet:boolean}){
 return <span className={'today-example-return'+(quiet?' quiet':'')} aria-label="오늘 날짜로 돌아가기">{quiet?'오늘':'오늘로'}</span>;
}

function DateExample({variant}:{variant:Variant}){
 const strip=variant.startsWith('strip'),quiet=variant.endsWith('quiet');
 return <div className={'today-example '+variant}>
  <div className="today-example-eyebrow">지난 날짜의 기록</div>
  <div className="today-example-heading">
   <span className="today-example-arrow" aria-hidden="true">‹</span>
   <strong>9월 29일 화요일</strong>
   <span className="today-example-arrow" aria-hidden="true">›</span>
   <span className="today-example-calendar" aria-label="달력"><CalendarIcon/></span>
   {!strip&&<TodayReturn quiet={quiet}/>}
  </div>
  <div className="today-example-week-wrap">
   {strip&&<TodayReturn quiet={quiet}/>}
   <div className="today-example-week" aria-label="주간 날짜 예시">{weekdays.map(([name,date])=><span key={name}><i>{name}</i><b className={date==='29'?'selected':''}>{date}</b><small>{date==='30'?'오늘':'\u00a0'}</small></span>)}</div>
  </div>
 </div>;
}

export default function TodayStudy(){return <main className="today-study">
 <header><p>일간 날짜 조작 · 부분 시안</p><h1>‘오늘로’ 버튼 위치 비교</h1><div className="today-study-note">기존 날짜 제목·양옆 화살표·달력 아이콘·7일 띠는 유지하고, ‘오늘’의 모양과 위치만 비교합니다. 이 화면의 조작은 작동하지 않습니다.</div></header>
 <section className="today-study-option"><div className="today-option-label"><span>1 · 현재 모양</span><p>원래 위치에서 2px 내림. 밑줄이 있는 ‘오늘로’.</p></div><DateExample variant="inline-current"/></section>
 <section className="today-study-option"><div className="today-option-label"><span>2 · 채택한 A안</span><p>원래 위치보다 2px 아래. 작은 점 뒤 상자·밑줄 없는 ‘오늘’.</p></div><DateExample variant="inline-quiet"/></section>
 <section className="today-study-option"><div className="today-option-label"><span>3 · 위치 이동</span><p>밑줄 있는 ‘오늘로’를 주간 선택기 오른쪽 위에 둠. 날짜 제목 줄이 단순해집니다.</p></div><DateExample variant="strip-current"/></section>
 <section className="today-study-option"><div className="today-option-label"><span>4 · 위치 이동 + A안</span><p>작은 점과 ‘오늘’을 주간 선택기 오른쪽 위에 둔 비교안입니다. 적용하지 않습니다.</p></div><DateExample variant="strip-quiet"/></section>
 <p className="today-study-foot">오늘 날짜를 보고 있을 때는 버튼을 숨기고, 다른 날짜를 볼 때만 표시하는 현재 동작을 유지합니다.</p>
 </main>}
