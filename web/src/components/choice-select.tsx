'use client';
import {Children,createContext,isValidElement,useContext,useEffect,useRef,useState} from 'react';
import type {ChangeEvent,KeyboardEvent,OptionHTMLAttributes,ReactElement,ReactNode,SelectHTMLAttributes} from 'react';

const PreviewChoices=createContext(false);

export function PreviewChoiceProvider({children}:{children:ReactNode}){return <PreviewChoices.Provider value>{children}</PreviewChoices.Provider>;}

type SelectProps=SelectHTMLAttributes<HTMLSelectElement> & {children:ReactNode};
type Choice={value:string;label:ReactNode;disabled:boolean};

export function ChoiceSelect({children,value,onChange,disabled,className,...nativeProps}:SelectProps){
 const preview=useContext(PreviewChoices),[open,setOpen]=useState(false),root=useRef<HTMLSpanElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null);
 const choices=Children.toArray(children).filter(isValidElement).map(child=>{const option=child as ReactElement<OptionHTMLAttributes<HTMLOptionElement>>;return {value:String(option.props.value??''),label:option.props.children,disabled:!!option.props.disabled};}) as Choice[];
 const selected=choices.find(option=>option.value===String(value??''))||choices[0];
 useEffect(()=>{if(!open)return;function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 useEffect(()=>{if(open){const options=list.current?.querySelectorAll<HTMLElement>('[role="option"]');(Array.from(options||[]).find(option=>option.getAttribute('aria-selected')==='true')||options?.[0])?.focus();}},[open]);
 if(!preview)return <select value={value} onChange={onChange} disabled={disabled} className={className} {...nativeProps}>{children}</select>;
 function choose(next:string){onChange?.({target:{value:next}} as ChangeEvent<HTMLSelectElement>);setOpen(false);trigger.current?.focus();}
 function key(event:KeyboardEvent<HTMLSpanElement>){if(event.key==='Escape'&&open){event.preventDefault();setOpen(false);trigger.current?.focus();return;}if(!open){if(['Enter',' ','ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true);}return;}const options=Array.from(list.current?.querySelectorAll<HTMLElement>('[role="option"]')||[]).filter(option=>option.getAttribute('aria-disabled')!=='true');const current=options.indexOf(document.activeElement as HTMLElement);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();options[(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}else if(event.key==='Home'||event.key==='End'){event.preventDefault();options[event.key==='Home'?0:options.length-1]?.focus();}else if(event.key==='Enter'||event.key===' '){const focused=document.activeElement as HTMLElement;if(focused.getAttribute('role')==='option'){event.preventDefault();choose(focused.dataset.value||'');}}}
 return <span ref={root} className={'study-choice'+(className?' '+className:'')} onKeyDown={key} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}>
  <button ref={trigger} type="button" className="study-choice-trigger" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={nativeProps['aria-label']} onClick={()=>setOpen(v=>!v)}><span>{selected?.label}</span><span className="study-choice-chevron" aria-hidden="true">⌄</span></button>
  {open&&<div ref={list} className="study-choice-options" role="listbox" aria-label={nativeProps['aria-label']}>{choices.map(option=><div role="option" key={option.value} tabIndex={-1} data-value={option.value} aria-selected={option.value===String(value??'')} aria-disabled={option.disabled} className="study-choice-option" onClick={event=>{event.preventDefault();event.stopPropagation();if(!option.disabled)choose(option.value);}}>{option.label}</div>)}</div>}
 </span>;
}
