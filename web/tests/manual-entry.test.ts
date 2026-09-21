import test from 'node:test';
import assert from 'node:assert/strict';
import {manualRunSegments,localInstant} from '../src/lib/schedule.ts';
import type {Run} from '../src/lib/contracts.ts';
const now=Date.parse(localInstant('2026-09-21','11:23'));
test('manual future end is explained; past and exact-now are allowed',()=>{
 assert.throws(()=>manualRunSegments(localInstant('2026-09-21','09:00'),localInstant('2026-09-21','13:00'),undefined,now),/현재 시간을 넘겨/);
 assert.equal(manualRunSegments(localInstant('2026-09-21','09:00'),localInstant('2026-09-21','11:23'),undefined,now).length,1);
 assert.throws(()=>manualRunSegments(localInstant('2026-09-21','10:00'),localInstant('2026-09-21','09:00'),undefined,now),/종료 시각/);
});
test('existing nonwork intervals retain exact boundaries and cannot be silently removed',()=>{
 const a='2026-09-18T09:43:48.172Z',b='2026-09-18T10:02:14.372Z',pause='2026-09-18T10:02:06.644Z';
 const run={segments:[{kind:'work',started_at:a,ended_at:pause},{kind:'pause',started_at:pause,ended_at:b}]} as Run;
 const parts=manualRunSegments(a,b,run,now);assert.equal(parts[0].startedAt,a);assert.equal(parts[1].startedAt,pause);assert.equal(parts[1].endedAt,b);assert.equal(parts[1].kind,'pause');
 assert.throws(()=>manualRunSegments(a,'2026-09-18T10:00:00Z',run,now),/휴식·중단/);
});
