'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';

type Confirmation={title:string;description:string;confirmLabel:string};
type Confirm=(request:Confirmation)=>Promise<boolean>;
const Context=createContext<Confirm|null>(null);

export function ConfirmProvider({children}:{children:ReactNode}){
 const [request,setRequest]=useState<Confirmation|null>(null);
 const dialog=useRef<HTMLDialogElement>(null),resolve=useRef<((accepted:boolean)=>void)|null>(null);
 const confirm=useCallback<Confirm>(next=>new Promise(accept=>{resolve.current?.(false);resolve.current=accept;setRequest(next);}),[]);
 const finish=useCallback((accepted:boolean)=>{dialog.current?.close();resolve.current?.(accepted);resolve.current=null;setRequest(null);},[]);
 useEffect(()=>{const element=dialog.current;if(request&&!element?.open)element?.showModal();},[request]);
 useEffect(()=>()=>{resolve.current?.(false);},[]);
 return <Context.Provider value={confirm}>{children}<dialog className="haru-confirm-dialog" ref={dialog} aria-labelledby="haru-confirm-title" aria-describedby="haru-confirm-description" onCancel={event=>{event.preventDefault();finish(false);}}><div className="eyebrow">HARULEAF</div><h2 id="haru-confirm-title" data-typo-role="title">{request?.title}</h2><p id="haru-confirm-description">{request?.description}</p><div className="actions"><button className="btn" autoFocus onClick={()=>finish(false)}>취소</button><button className="btn danger" onClick={()=>finish(true)}>{request?.confirmLabel}</button></div></dialog></Context.Provider>;
}

export function useConfirm(){const confirm=useContext(Context);if(!confirm)throw new Error('ConfirmProvider is missing');return confirm;}
