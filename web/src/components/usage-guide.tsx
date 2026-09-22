'use client';
import {useEffect,useRef} from 'react';
export function UsageGuide(){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const close=(e:MessageEvent)=>{if(e.origin===location.origin&&e.source===dialog.current?.querySelector('iframe')?.contentWindow&&e.data?.type==='haru-guide-close')dialog.current?.close();};window.addEventListener('message',close);return()=>window.removeEventListener('message',close);},[]);
 return <><button className="usage-guide-open" onClick={()=>dialog.current?.showModal()}>사용 안내</button><dialog ref={dialog} className="usage-guide-dialog" aria-label="Haru 사용 안내"><div className="usage-guide-head"><span>예시로 사용법 둘러보기</span><button className="btn sm" onClick={()=>dialog.current?.close()} autoFocus>안내 닫기 ×</button></div><iframe src="/guide/index.html" title="계획부터 기록까지 사용 안내"/></dialog></>;
}
