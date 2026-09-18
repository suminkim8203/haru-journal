// Local HTTP → Next.js API → Supabase SDK → test RPC adapter → PGlite.
// This is not a real NAS/Supabase or browser verification, and never changes external data.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const diaryId = '00000000-0000-4000-8000-000000000006';
const db = new PGlite();
await db.exec('create role anon;create role authenticated;create role service_role;');
for (const file of ['0001_core.sql', '0002_plan_priority_task_tags.sql']) {
  await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
}
const fixtureKey = 'local-test-' + randomUUID();
let legacy = false, app, logs = '';
async function snapshot() {
  return (await db.query('select public.journal_snapshot($1) data', [diaryId])).rows[0].data;
}
const fixture = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  try {
    assert.equal(request.headers.apikey, fixtureKey);
    assert.equal(request.headers.authorization, 'Bearer ' + fixtureKey);
    let body = ''; for await (const chunk of request) body += chunk;
    const p = JSON.parse(body);
    if (request.url === '/rest/v1/rpc/journal_snapshot') {
      const value = await snapshot(); if (legacy) delete value.schemaVersion;
      response.end(JSON.stringify(value));
    } else if (request.url === '/rest/v1/rpc/journal_command') {
      const result = await db.query('select public.journal_command($1,$2,$3,$4,$5::jsonb) data',
        [p.p_diary_id, p.p_request_id, p.p_expected_revision, p.p_command, JSON.stringify(p.p_payload)]);
      response.end(JSON.stringify(result.rows[0].data));
    } else { response.statusCode = 404; response.end('{}'); }
  } catch (e) { response.statusCode = 400; response.end(JSON.stringify({ code: e.code || '22023', message: 'Test adapter rejected request' })); }
});
try {
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const appPort = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const n = socket.address().port; socket.close(() => resolve(n)); }); });
  const base = `http://127.0.0.1:${appPort}`;
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(appPort)], {
    cwd, env: { ...process.env, APP_ORIGIN: '', SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`, SUPABASE_SECRET_KEY: fixtureKey },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  app.stdout.on('data', b => logs += b); app.stderr.on('data', b => logs += b);
  let ready = false;
  for (let n = 0; n < 80; n++) {
    if (app.exitCode !== null) throw Error('Test application exited before readiness');
    try { const r = await fetch(base + '/api/diary', { signal: AbortSignal.timeout(500) }); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(ready, true, 'Application starts with test RPC adapter');
  async function post(command, payload, revision, requestId = randomUUID()) {
    const response = await fetch(base + '/api/commands', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ requestId, expectedRevision: revision, command, payload }),
    });
    return { status: response.status, value: await response.json(), requestId };
  }
  const title = '<script>window.fixture=1</script>';
  const planPayload = { kind: 'general', title, startDate: '2026-09-18', endDate: '2026-09-30', successText: '확인', estimatedMinutes: 120, priority: 'high' };
  const p = await post('create_plan', planPayload, 0); assert.equal(p.status, 200);
  const replay = await post('create_plan', planPayload, 0, p.requestId); assert.deepEqual(replay.value, p.value);
  const t = await post('create_task', { planId: p.value.entityId, title: '실제 API 검증', priority: 'low', estimatedMinutes: 30, tags: [' 독서 ', '독서', '공부'] }, 1); assert.equal(t.status, 200);
  const edit = await post('update_plan', { ...planPayload, planId: p.value.entityId, priority: 'normal', estimatedMinutes: 150 }, 2); assert.equal(edit.status, 200);
  const read = await fetch(base + '/api/diary'); assert.equal(read.status, 200); assert.equal(read.headers.get('cache-control'), 'no-store');
  const s = await read.json(); assert.equal(s.plans.length, 1); assert.equal(s.plans[0].priority, 'normal'); assert.equal(s.plans[0].estimated_minutes, 150);
  assert.equal(s.tasks[0].estimated_minutes, 30); assert.equal(s.tasks[0].tags.length, 2); assert.equal(s.plans[0].history[0].previous_value.estimated_minutes, 120);
  const html = await (await fetch(base)).text();
  assert.ok(html.includes('HaruLeaf')); assert.ok(html.includes('&lt;script&gt;window.fixture=1&lt;/script&gt;'));
  assert.equal(html.includes('<script>window.fixture=1</script>'), false); assert.equal(html.includes(fixtureKey), false);
  assert.ok(html.includes('지금은 로그인이 없어 링크를 아는 사람은 누구나 볼 수 있습니다.'));
  const invalid = await post('update_task', { taskId: t.value.entityId, title: '잘못된 태그', tags: [42] }, 3); assert.equal(invalid.status, 400);
  const conflict = await post('update_plan', { ...planPayload, planId: p.value.entityId }, 1); assert.equal(conflict.status, 409);
  legacy = true;
  const blocked = await post('create_plan', { ...planPayload, title: '구형 저장소 차단' }, 3);
  assert.equal(blocked.status, 503); assert.equal(blocked.value.error.code, 'SCHEMA_UPDATE_REQUIRED');
  assert.equal((await snapshot()).plans.length, 1);
  console.log('PASS local HTTP integration: SDK/RPC storage, reload, fields/tags/history, idempotency, conflict, schema gate, escaped HTML, public notice and test key absent from HTML.');
} finally {
  if (app && app.exitCode === null) { const closed = once(app, 'close'); app.kill(); await closed; }
  if (fixture.listening) await new Promise(resolve => fixture.close(resolve));
  await db.close();
}
