'use client';
import {useLayoutEffect,useRef,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
export function PickerDialog({anchor,onClose,kind='date',children}:{anchor:RefObject<HTMLElement|null>;onClose:()=>void;kind?:'date'|'time';children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useLayoutEffect(()=>{const el=dialog.current;if(!el)return;el.showModal();function position(){if(!el||!anchor.current)return;const r=anchor.current.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;el.style.left=Math.max(12,Math.min(document.documentElement.clientWidth-w-12,r.left))+'px';el.style.top=Math.max(12,Math.min(document.documentElement.clientHeight-h-12,r.bottom+8+h<document.documentElement.clientHeight?r.bottom+8:r.top-h-8))+'px';}position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);el.close();};},[anchor]);
 return createPortal(<dialog ref={dialog} className={kind+'-dialog'} aria-label={kind==='date'?'날짜 선택':'시각 선택'} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>{children}</dialog>,document.body);
}
