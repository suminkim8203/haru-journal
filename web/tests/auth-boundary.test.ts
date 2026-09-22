import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const sa='20000000-0000-4000-8000-000000000001',sb='20000000-0000-4000-8000-000000000002';
async function setup(){const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema journal;create schema auth;
 create table journal.diaries(id uuid primary key);
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users,created_at timestamptz,not_after timestamptz);
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
 `);await db.exec(await readFile(new URL('../supabase/staged-t07/01_session_boundary.sql',import.meta.url),'utf8'));
 await db.query('insert into auth.users values ($1,now()),($2,now())',[a,b]);
 await db.query('insert into journal.diaries values ($1),($2)',[a,b]);
 await db.query('insert into journal.account_diaries(user_id,diary_id) values ($1,$1),($2,$2)',[a,b]);
 await db.query('insert into auth.sessions values ($1,$2,now(),null),($3,$4,now(),null)',[sa,a,sb,b]);return db;}
async function claim(db:PGlite,u:string,s:string,method='password'){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,session_id:s,amr:[{method}]})]);}
const read=(db:PGlite)=>db.query<{id:string}>('select journal.require_account_diary() id');
test('local boundary derives diary from session owner and rejects crossed session identities',async()=>{const db=await setup();try{
 await claim(db,a,sa);assert.equal((await read(db)).rows[0].id,a);
 await claim(db,b,sb);assert.equal((await read(db)).rows[0].id,b);
 await claim(db,a,sb);await assert.rejects(read(db),{code:'PT401'});
 await claim(db,b,sa);await assert.rejects(read(db),{code:'PT401'});
}finally{await db.close()}});
test('same claims fail after server session removal; expiry and recovery also fail closed',async()=>{const db=await setup();try{
 await claim(db,a,sa);await read(db);await db.query('delete from auth.sessions where id=$1',[sa]);await assert.rejects(read(db),{code:'PT401'});
 await claim(db,b,sb,'recovery');await assert.rejects(read(db),{code:'PT403'});
 await claim(db,b,sb);await db.query("update auth.sessions set created_at=now()-interval '8 days' where id=$1",[sb]);await assert.rejects(read(db),{code:'PT401'});
}finally{await db.close()}});
test('anonymous, unverified users and direct role access are denied',async()=>{const db=await setup();try{
 await assert.rejects(read(db),{code:'PT401'});
 await claim(db,a,sa);await db.query('update auth.users set email_confirmed_at=null where id=$1',[a]);await assert.rejects(read(db),{code:'PT401'});
 await db.exec('set role authenticated');await assert.rejects(read(db),{code:'42501'});
 await assert.rejects(db.query('select * from journal.account_diaries'),{code:'42501'});
}finally{await db.close()}});
