import test from 'node:test';
import assert from 'node:assert/strict';
import {compatibleSnapshot,DIARY_ID} from '../src/lib/contracts.ts';
test('private snapshot must match the server-established diary, never the former public diary',()=>{
 const a='90000000-0000-4000-8000-000000000021',b='90000000-0000-4000-8000-000000000022';
 const data={schemaVersion:6,diaryId:a,timezone:'Asia/Seoul',revision:0,plans:[],tasks:[],placements:[],runs:[],thoughts:[],reflections:[],closures:[],improvements:[],trash:[]};
 assert.equal(compatibleSnapshot(data,a),true);
 assert.equal(compatibleSnapshot(data,b),false);
 assert.equal(compatibleSnapshot({...data,diaryId:DIARY_ID},a),false);
 assert.equal(compatibleSnapshot({...data,diaryId:DIARY_ID}),true);
});
