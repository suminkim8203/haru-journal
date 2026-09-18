import {Plans} from '@/components/plans';
import {snapshot,storageConfigured} from '@/lib/storage.server';
import type {Snapshot} from '@/lib/contracts';
export const dynamic='force-dynamic';
export default async function Home(){let initial:Snapshot|null=null,issue:string|null=null;if(storageConfigured()){try{initial=await snapshot()}catch{issue='저장소에 연결하지 못했습니다. 잠시 후 다시 확인해 주세요.';}}return <main><header><div className="mast-meta"><span>PLAN · DO · SEE</span><span>DAILY JOURNAL</span></div><div className="mast-title"><p>오늘 할 일을 적고<br/>보낸 시간을 남깁니다.</p><div><h1>HaruLeaf</h1><small>PLAN · DO · SEE JOURNAL</small></div><p>생각을 적고<br/>하루를 돌아봅니다.</p></div><p className="public-notice">지금은 로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다. 남이 봐도 괜찮은 내용만 넣으세요.</p></header><div className="main-content"><Plans initial={initial} issue={issue}/></div><footer className="site-footer">계획과 실제 시간, 단상과 회고</footer></main>}
