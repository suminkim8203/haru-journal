import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {newPasswordIssue,requestPolicy} from '../supabase/functions/auth-guard/policy.ts';
test('server policy enforces Unicode length, whitespace and byte ceiling without changing credentials',()=>{
 assert.equal(newPasswordIssue('가나다라마바사아'),null);assert.ok(newPasswordIssue('가나다'));assert.ok(newPasswordIssue('abcdefg h'));assert.ok(newPasswordIssue('가'.repeat(25)));
 assert.deepEqual(requestPolicy('token','POST',{password:'old password'}),{});
 assert.ok(requestPolicy('user','PUT',{password:'short'}).error);
 assert.ok(requestPolicy('verify','GET',{}).error);assert.ok(requestPolicy('verify','POST',{token_hash:'opaque',type:'signup'}).error);
 assert.ok(requestPolicy('verify','POST',{email:'a@example.invalid',token:'123456',type:'magiclink'}).error);
 assert.equal(requestPolicy('verify','POST',{email:'A@example.invalid',token:'123456',type:'recovery'}).email,'a@example.invalid');
});
test('server attempts stop at five, resend cannot reset guesses, expiry/success restore access, public callers denied',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;create schema journal;');
 await db.exec(await readFile(new URL('../supabase/staged-t07/06_auth_attempts.sql',import.meta.url),'utf8'));
 const subject='a'.repeat(64),run=async(action:string)=>(await db.query<{v:boolean}>('select public.haru_auth_attempt($1,$2) v',[subject,action])).rows[0].v;
 await db.exec('set role service_role');assert.equal(await run('issue'),true);
 for(let i=0;i<5;i++){assert.equal(await run('issue'),true);assert.equal(await run('verify'),true)}
 assert.equal(await run('verify'),false);assert.equal(await run('issue'),false);
 await db.exec('reset role');await db.query("update journal.auth_attempt_windows set expires_at=now()-interval '1 second'");await db.exec('set role service_role');
 assert.equal(await run('issue'),true);assert.equal(await run('verify'),true);assert.equal(await run('success'),true);assert.equal(await run('issue'),true);
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(run('success'),{code:'42501'});await assert.rejects(db.query('select * from journal.auth_attempt_windows'),{code:'42501'});}
 }finally{await db.close()}
});
