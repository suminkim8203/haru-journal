import {redirect} from 'next/navigation';
import {privateJournalEnabled} from '@/lib/auth-mode';
import {AuthForm} from '@/components/auth-form';
import './auth.css';
export default function AuthPage(){if(privateJournalEnabled)redirect('/');return <main className="paper auth-paper"><header className="masthead"><div className="mast-meta">PLAN · DO · SEE</div><div className="mast-title"><div className="mast-brand"><h1 className="haru-masthead" lang="en">Haru<span>Leaf</span></h1><div className="edition">PLAN · DO · SEE JOURNAL</div></div></div></header><p className="auth-check-notice">인증 연결 확인 화면입니다. 기존 기록의 개인 계정 이전은 아직 진행하지 않았습니다.</p><AuthForm/></main>}
