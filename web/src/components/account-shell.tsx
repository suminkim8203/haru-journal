import {EditionDate} from './edition-date';
import {PrivateJournal} from './private-journal';
import {privateJournalEnabled} from '@/lib/auth-mode';
import {redirect} from 'next/navigation';
import '@/app/auth/auth.css';

export function AccountShell({screen}:{screen:'account'|'deletion'}){
 if(!privateJournalEnabled)redirect('/');
 return <div className="paper">
  <header className="masthead"><div className="mast-meta" data-typo-role="info"><span>PLAN · DO · SEE</span><EditionDate/></div><div className="mast-title"><div className="mast-brand"><h1 lang="en" className="haru-masthead" data-typo-role="brand">Haru<span>Leaf</span></h1><div className="edition" data-typo-role="info">PLAN · DO · SEE JOURNAL</div></div><div className="mast-aside right-aside" data-typo-role="info">PLAN<br/>DO<br/>SEE</div></div></header>
  <PrivateJournal screen={screen}/>
  <footer className="footer" data-typo-role="info"><span>기록을 평가하지 않고, 계획과 실제를 나란히 봅니다.</span><span>Haru</span></footer>
 </div>;
}
