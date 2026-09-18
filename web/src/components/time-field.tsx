'use client';
import {useState} from 'react';
export function TimeField({label,value,onChange,min='00:00',max='23:59'}:{label:string;value:string;onChange:(value:string)=>void;min?:string;max?:string}){
 const [open,setOpen]=useState(false);
 const hours=Number(value.split(':')[0]||0),minutes=Number(value.split(':')[1]||0);
 const bound=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
 const valid=(h:number,m:number)=>h*60+m>=bound(min)&&h*60+m<=bound(max);
 const set=(h:number,m:number)=>onChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
 return <div className="time-field"><label>{label}<div className="time-entry"><input aria-label={label} required inputMode="numeric" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="09:30" maxLength={5} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" aria-label={label+' 시계 열기'} aria-expanded={open} onClick={()=>setOpen(!open)}>◷</button></div></label>
 {open&&<div className="clock-popover"><div className="section-heading"><span>{label}</span><button type="button" className="text-button" onClick={()=>setOpen(false)} aria-label="시계 닫기">×</button></div><p>시</p><div className="clock-grid">{Array.from({length:24},(_,h)=><button key={h} type="button" disabled={h*60+59<bound(min)||h*60>bound(max)} aria-pressed={h===hours} onClick={()=>set(h,valid(h,minutes)?minutes:Math.max(0,Math.min(59,bound(min)-h*60)))}>{String(h).padStart(2,'0')}</button>)}</div><p>분 · 정확한 분은 입력창에 직접 입력</p><div className="clock-grid">{Array.from({length:12},(_,i)=><button key={i} type="button" disabled={!valid(hours,i*5)} aria-pressed={i*5===minutes} onClick={()=>{set(hours,i*5);setOpen(false);}}>{String(i*5).padStart(2,'0')}</button>)}</div><div className="quick-times">{[...new Set([min,max])].map(time=><button type="button" key={time} onClick={()=>{onChange(time);setOpen(false);}}>{time}</button>)}</div></div>}
 </div>;
}
