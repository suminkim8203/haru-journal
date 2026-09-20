'use client';
import {useEffect,useState} from 'react';
import {seoulDate} from '@/lib/schedule';
export function EditionDate(){const [date,setDate]=useState('');useEffect(()=>{setDate(seoulDate());const timer=setInterval(()=>setDate(seoulDate()),60000);return()=>clearInterval(timer);},[]);return <span>일일 기록지{date?' · '+date.replaceAll('-','.'):''}</span>;}
