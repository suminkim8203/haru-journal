import test from 'node:test';import assert from 'node:assert/strict';import {duration} from '../src/lib/review.ts';
test('time evidence preserves seconds so actual minus expected is visibly consistent',()=>{assert.equal(duration(75*60000),'1시간 15분');assert.equal(duration((27*60+15)*1000),'27분 15초');assert.equal(duration((27*60+15)*1000-75*60000),'−47분 45초');assert.equal(duration(0),'0분');});
