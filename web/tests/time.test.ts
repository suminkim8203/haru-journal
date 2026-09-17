import test from 'node:test';
import assert from 'node:assert/strict';
import { workMilliseconds } from '../src/lib/time.ts';
test('pauses excluded and adjacent dates do not double count',()=>{
 const s=[{kind:'work' as const,start:0,end:60},{kind:'pause' as const,start:60,end:90},{kind:'interrupt' as const,start:90,end:100},{kind:'work' as const,start:100,end:160}];
 assert.equal(workMilliseconds(s,0,120,160),80);assert.equal(workMilliseconds(s,120,200,160),40);
});
test('open timer recomputes from current time',()=>assert.equal(workMilliseconds([{kind:'work',start:10,end:null}],0,100,60),50));
test('overlap and non-final open segments rejected',()=>{
 assert.throws(()=>workMilliseconds([{kind:'work',start:0,end:40},{kind:'pause',start:30,end:50}],0,100,100));
 assert.throws(()=>workMilliseconds([{kind:'work',start:0,end:null},{kind:'work',start:60,end:90}],0,100,100));
});
