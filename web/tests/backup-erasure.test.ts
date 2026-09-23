import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('offline backup erasure preserves other account rows and supports pre-auth backup schema',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema journal;create schema auth;create table auth.users(id uuid primary key);create table journal.diaries(id uuid primary key);create table journal.tasks(id int,diary_id uuid references journal.diaries(id),body text);create table journal.unrelated(id int);insert into journal.unrelated values(1);`);
 const a='92000000-0000-4000-8000-000000000001',b='92000000-0000-4000-8000-000000000002';
 await db.query('insert into journal.diaries values($1),($2)',[a,b]);await db.query('insert into auth.users values($1),($2)',[a,b]);await db.query("insert into journal.tasks values(1,$1,'deleted'),(2,$2,'preserved')",[a,b]);
 await db.query("select set_config('haru.erase_user',$1,false),set_config('haru.erase_diary',$1,false)",[a]);
 await db.exec(await readFile(new URL('../../infra/operations/erase-offline-account.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query('select id,body from journal.tasks')).rows,[{id:2,body:'preserved'}]);assert.equal((await db.query('select * from auth.users')).rows.length,1);assert.equal((await db.query('select * from journal.unrelated')).rows.length,1);
 }finally{await db.close()}
});
