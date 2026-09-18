const records=await readFile(new URL('../supabase/migrations/0004_records_archive.sql',import.meta.url),'utf8');
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DIARY_ID, parseCommand, compatibleSnapshot, type Snapshot } from '../src/lib/contracts.ts';
import { visibleTasks, type TaskView } from '../src/lib/task-view.ts';
import { sameSiteRequest } from '../src/lib/request-origin.ts';
const core = await readFile(new URL('../supabase/migrations/0001_core.sql', import.meta.url), 'utf8');
const schedule = await readFile(new URL('../supabase/migrations/0003_schedule_runs.sql',import.meta.url),'utf8');
const followup = await readFile(new URL('../supabase/migrations/0002_plan_priority_task_tags.sql', import.meta.url), 'utf8');
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const plan = { kind: 'general', title: '검증 계획', startDate: '2026-09-18', endDate: '2026-09-30', estimatedMinutes: 120, priority: 'high', successText: '저장 확인' };
async function setup(upgrade = true) {
  const db = new PGlite(); await db.exec('create role anon;create role authenticated;create role service_role;');
  await db.exec(core); if (upgrade) { await db.exec(followup); await db.exec(schedule);await db.exec(records); } return db;
}
async function command(db: PGlite, n: number, revision: number, name: string, payload: unknown) {
  const result = await db.query<{ result: { entityId: string; revision: number } }>(
    'select public.journal_command($1,$2,$3,$4,$5::jsonb) result', [DIARY_ID, id(n), revision, name, JSON.stringify(payload)]);
  return result.rows[0].result;
}
async function snapshot(db: PGlite) {
  return (await db.query<{ data: Snapshot }>('select public.journal_snapshot($1) data', [DIARY_ID])).rows[0].data;
}
test('follow-up migration preserves existing IDs, values and history; supplies default priority and empty tags', async () => {
  const db = await setup(false);
  try {
    const p = await command(db, 1, 0, 'create_plan', plan);
    const t = await command(db, 2, 1, 'create_task', { planId: p.entityId, title: '기존 할 일', estimatedMinutes: 25 });
    await command(db, 3, 2, 'set_task_complete', { taskId: t.entityId, complete: true });
    await db.exec(followup); await db.exec(schedule);await db.exec(records);
    const s = await snapshot(db);
    assert.equal(compatibleSnapshot(s), true); assert.equal(s.revision, 3); assert.equal(s.plans[0].id, p.entityId); assert.equal(s.plans[0].estimated_minutes, 120);
    assert.equal(s.plans[0].priority, 'normal'); assert.equal(s.tasks[0].id, t.entityId);
    assert.equal(s.tasks[0].complete, true); assert.deepEqual(s.tasks[0].tags, []);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from journal.revisions')).rows[0].n, 1);
  } finally { await db.close(); }
});
test('plan priority/estimate update preserves original plan and does not change task estimates', async () => {
  const db = await setup();
  try {
    const p = await command(db, 1, 0, 'create_plan', plan);
    await command(db, 2, 1, 'create_task', { planId: p.entityId, title: '다른 예상', estimatedMinutes: 30 });
    await command(db, 3, 2, 'update_plan', { ...plan, planId: p.entityId, priority: 'low', estimatedMinutes: 150, title: '수정 계획' });
    const s = await snapshot(db); assert.equal(s.plans[0].priority, 'low'); assert.equal(s.plans[0].estimated_minutes, 150); assert.equal(s.tasks[0].estimated_minutes, 30);
    const history = await db.query<{ previous_value: { title: string; priority: string; estimated_minutes: number } }>('select previous_value from journal.revisions where entity_type=\'plan\'');
    assert.equal(history.rows[0].previous_value.title, plan.title); assert.equal(history.rows[0].previous_value.priority, 'high'); assert.equal(history.rows[0].previous_value.estimated_minutes, 120);
    assert.equal(s.plans[0].history[0].previous_value.title, plan.title);
  } finally { await db.close(); }
});
test('tags have stable IDs, deduplicate per diary and task edits preserve old tag evidence', async () => {
  const db = await setup();
  try {
    const p = await command(db, 1, 0, 'create_plan', plan);
    const t = await command(db, 2, 1, 'create_task', { planId: p.entityId, title: '태그 할 일', tags: [' 독서 ', '독서', '공부'] });
    const s = await snapshot(db); assert.deepEqual(s.tasks[0].tags.map(tag => tag.name), ['공부', '독서']);
    const oldTags = s.tasks[0].tags;
    await command(db, 3, 2, 'create_task', { planId: p.entityId, title: '함께 읽기', tags: ['독서'] });
    assert.equal((await snapshot(db)).tasks[1].tags[0].id, oldTags.find(tag => tag.name === '독서')!.id);
    const payload = { taskId: t.entityId, title: '수정 할 일', priority: 'low', estimatedMinutes: 40, tags: ['산책'] };
    const saved = await command(db, 4, 3, 'update_task', payload);
    assert.deepEqual(await command(db, 4, 3, 'update_task', payload), saved);
    const current = await snapshot(db); assert.deepEqual(current.tasks[0].tags.map(tag => tag.name), ['산책']);
    const history = await db.query<{ previous_value: { tags: unknown[] } }>('select previous_value from journal.revisions where entity_type=\'task\'');
    assert.deepEqual(history.rows[0].previous_value.tags, oldTags);
    await command(db, 5, 4, 'update_task', { taskId: t.entityId, title: '태그 유지' });
    assert.equal((await snapshot(db)).tasks[0].tags[0].name, '산책');
    assert.equal((await snapshot(db)).tasks[0].estimated_minutes, 40);
    assert.equal((await snapshot(db)).tasks[0].priority, 'low');
    await command(db, 6, 5, 'update_task', { taskId: t.entityId, title: '태그 해제', tags: [] });
    assert.deepEqual((await snapshot(db)).tasks[0].tags, []);
  } finally { await db.close(); }
});
test('invalid updates roll back tags, history, receipt and revision, allowing a corrected retry', async () => {
  const db = await setup();
  try {
    const p = await command(db, 1, 0, 'create_plan', plan);
    const t = await command(db, 2, 1, 'create_task', { planId: p.entityId, title: '원문', tags: ['독서'] });
    const before = await snapshot(db);
    await assert.rejects(command(db, 3, 2, 'update_task', { taskId: t.entityId, title: '잘못된 수정', priority: 'urgent', tags: ['산책'] }));
    await assert.rejects(command(db, 3, 2, 'update_task', { taskId: t.entityId, title: '잘못된 태그', tags: [42] }), /Invalid tags/);
    await assert.rejects(command(db, 3, 2, 'update_task', { taskId: t.entityId, title: '빈 태그', tags: [' '] }), /Invalid tags/);
    assert.deepEqual(await snapshot(db), before);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from journal.revisions')).rows[0].n, 0);
    await command(db, 3, 2, 'update_task', { taskId: t.entityId, title: '정상 수정', tags: ['산책'] });
    assert.equal((await snapshot(db)).revision, 3);
  } finally { await db.close(); }
});
test('tags and links reject cross-diary references and are inaccessible to anonymous users', async () => {
  const db = await setup();
  try {
    const p = await command(db, 1, 0, 'create_plan', plan);
    const t = await command(db, 2, 1, 'create_task', { planId: p.entityId, title: '할 일', tags: ['독서'] });
    const tag = (await snapshot(db)).tasks[0].tags[0];
    await db.query('insert into journal.diaries(id) values($1)', [id(99)]);
    await assert.rejects(db.query('insert into journal.task_tags(diary_id,task_id,tag_id) values($1,$2,$3)', [id(99), t.entityId, tag.id]), /foreign key/);
    await db.exec('set role anon'); await assert.rejects(db.query('select * from journal.tags'), /permission denied/);
    await assert.rejects(db.query('select * from journal.task_tags'), /permission denied/);
  } finally { await db.close(); }
});
test('a second complete command does not create another completion history or alter the timestamp', async () => {
  const db = await setup();
  try {
    const p = await command(db, 1, 0, 'create_plan', plan);
    const t = await command(db, 2, 1, 'create_task', { planId: p.entityId, title: '완료 검증' });
    const complete = await command(db, 3, 2, 'set_task_complete', { taskId: t.entityId, complete: true });
    const before = await snapshot(db);
    const replay = await command(db, 4, 3, 'set_task_complete', { taskId: t.entityId, complete: true });
    assert.equal(replay.revision, complete.revision); assert.deepEqual(await snapshot(db), before);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from journal.revisions')).rows[0].n, 1);
  } finally { await db.close(); }
});
test('API validates priorities/tag types and normalizes tags without changing the draft', () => {
  const payload = { planId: id(2), title: '태그 검증', tags: [' 독서 ', '독서'] };
  const envelope = { requestId: id(1), expectedRevision: 0, command: 'create_task', payload };
  assert.deepEqual(parseCommand(envelope).payload.tags, ['독서']); assert.deepEqual(payload.tags, [' 독서 ', '독서']);
  for (const tags of [null, [''], [2], Array(21).fill('독서'), ['가'.repeat(31)]]) assert.throws(() => parseCommand({ ...envelope, payload: { ...payload, tags } }));
  for (const priority of ['urgent', ['high'], 1]) assert.throws(() => parseCommand({ ...envelope, payload: { ...payload, priority } }));
  assert.throws(() => parseCommand({ ...envelope, command: 'update_plan', payload: { ...plan, planId: 'missing' } }));
});
test('old or unrecognized storage versions are not accepted as the updated contract', () => {
  const base = { diaryId: DIARY_ID, timezone: 'Asia/Seoul', revision: 0, plans: [], tasks: [], placements: [], runs: [], thoughts: [], reflections: [], closures: [], improvements: [], trash: [] };
  assert.equal(compatibleSnapshot(base), false);
  assert.equal(compatibleSnapshot({ ...base, schemaVersion: 4 }), true);
  assert.equal(compatibleSnapshot({ ...base, schemaVersion: 4, revision: -1 }), false);
});
test('origin checks accept local browser Host or fixed HTTPS origin and reject cross-site/forwarded spoofing', () => {
  const request = (origin: string, extra = {}) => new Request('http://localhost:3100/api/commands', { headers: { Origin: origin, Host: '127.0.0.1:3100', ...extra } });
  assert.equal(sameSiteRequest(request('http://127.0.0.1:3100')), true);
  assert.equal(sameSiteRequest(request('http://127.0.0.1:3200')), false);
  assert.equal(sameSiteRequest(request('https://journal.example'), 'https://journal.example'), true);
  assert.equal(sameSiteRequest(request('https://evil.example', { 'X-Forwarded-Host': 'evil.example' })), false);
  assert.equal(sameSiteRequest(request('null')), false);
  assert.equal(sameSiteRequest(request('http://127.0.0.1:3100'), 'invalid'), false);
  assert.equal(sameSiteRequest(new Request('http://localhost:3100/api/commands')), true);
});
test('search/status/tag filters combine and sort ties remain deterministic without mutating data', () => {
  const base = { plan_id: id(1), description: '', estimated_minutes: 30, complete: false, tags: [{ id: id(9), name: '독서' }] };
  const tasks = [
    { ...base, id: id(3), title: '세 번째', due_date: null, priority: 'low' as const },
    { ...base, id: id(2), title: '두 번째', due_date: '2026-09-20', priority: 'high' as const, complete: true },
    { ...base, id: id(1), title: '첫 번째', due_date: '2026-09-20', priority: 'high' as const },
  ];
  const view: TaskView = { query: '독서', status: 'active', tag: id(9), sort: 'due' };
  assert.deepEqual(visibleTasks(tasks, view).map(t => t.id), [id(1), id(3)]);
  assert.deepEqual(visibleTasks(tasks, { ...view, status: 'all', sort: 'priority' }).map(t => t.id), [id(1), id(2), id(3)]);
  assert.deepEqual(visibleTasks(tasks, { ...view, query: '없음' }), []); assert.equal(tasks[0].id, id(3));
});
