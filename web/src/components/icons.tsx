import type {SVGProps} from 'react';
type Props=SVGProps<SVGSVGElement>;
const base={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.5,'aria-hidden':true as const};
export function CalendarIcon(p:Props){return <svg {...base} width="19" height="19" {...p}><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 2.5V7M16 2.5V7M8 14h2M14 14h2M8 17h2"/></svg>;}
export function ChevronIcon(p:Props){return <svg {...base} width="28" height="28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 5 7 7-7 7"/></svg>;}
export function ListIcon({collapsed=false,...p}:Props&{collapsed?:boolean}){return <svg {...base} strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 6h7M4 12h7M4 18h7"/><path d={collapsed?'m15 8 4 4-4 4':'m19 8-4 4 4 4'}/></svg>;}
export function BookmarkIcon({active,...p}:Props&{active:boolean}){return <svg width="17" height="21" viewBox="0 0 24 28" fill={active?'currentColor':'none'} stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}><path d="M7 3.5h10a2 2 0 0 1 2 2v19l-7-4.5-7 4.5v-19a2 2 0 0 1 2-2Z"/></svg>;}
