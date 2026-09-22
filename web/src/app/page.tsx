import {PrivateJournal} from '@/components/private-journal';
import {privateJournalEnabled} from '@/lib/auth-mode';
import './auth/auth.css';
import {JournalApp} from '@/components/journal-app';
import {EditionDate} from '@/components/edition-date';
export default function Home(){return <div className="paper">
 <header className="masthead">
  <div className="mast-meta" data-typo-role="info"><span>PLAN · DO · SEE</span><EditionDate/></div>
  <div className="mast-title">
   <div className="mast-brand"><h1 lang="en" className="haru-masthead" data-typo-role="brand">Haru<span>Leaf</span></h1><div className="edition" data-typo-role="info">PLAN · DO · SEE JOURNAL</div></div>
   <div className="mast-aside right-aside" data-typo-role="info">PLAN<br/>DO<br/>SEE</div>
  </div>
  {!privateJournalEnabled&&<div className="public-notice" data-typo-role="info"><span className="public-label">공개 안내</span><span>지금은 로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다. 남이 봐도 괜찮은 내용만 넣으세요.</span></div>}
 </header>
 {privateJournalEnabled?<PrivateJournal/>:<JournalApp initial={null} issue={null}/>}
 <footer className="footer" data-typo-role="info"><span>기록을 평가하지 않고, 계획과 실제를 나란히 봅니다.</span><span>Haru</span></footer>
</div>;}
