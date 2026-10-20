import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

async function loadModule(file, dependencies, globals = {}) {
  const source = await readFile(new URL(`../app/${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: { LEAD_WEBHOOK_URL: 'https://example.invalid/hook' } },
    URL, ...globals,
  }, { filename: file });
  return loadedModule.exports;
}

async function notifier({ failFirstQuery = false, failDelivery = false } = {}) {
  const queries = [], sent = [], failed = [];
  let active = 0, maximumActive = 0;
  const api = await loadModule('lib/lead-notifications.ts', {
    '@runtime/database': {
      databaseConfigured: () => true,
      async pendingDeliveries(channels, limit, leadId) {
        queries.push({ channels: Array.from(channels), limit, leadId });
        if (failFirstQuery && queries.length === 1) throw new Error('Database unavailable');
        return [{ id: leadId ?? 'old-failed-delivery', channel: 'webhook', attempts: 0 }];
      },
      markDeliverySent: async id => sent.push(id),
      markDeliveryFailed: async id => failed.push(id),
      queueDelivery: async () => {},
    },
    './notification-channels': { configuredDeliveryChannels: () => ['webhook'] },
    './smtp-email': {},
  }, {
    async fetch() {
      active++; maximumActive = Math.max(maximumActive, active);
      await Promise.resolve(); active--;
      return { ok: !failDelivery, status: failDelivery ? 503 : 200 };
    },
  });
  return { ...api, queries, sent, failed, maximumActive: () => maximumActive };
}

test('new lead deliveries are scoped and do not request old failed deliveries', async () => {
  const n = await notifier();
  await n.flushPendingNotifications('new-lead');
  assert.deepEqual(n.queries, [{ channels: ['webhook'], limit: 20, leadId: 'new-lead' }]);
  assert.deepEqual(n.sent, ['new-lead']);
});

test('an explicit general retry keeps the unscoped queue available', async () => {
  const n = await notifier(); await n.flushPendingNotifications();
  assert.equal(n.queries[0].leadId, undefined);
  assert.deepEqual(n.sent, ['old-failed-delivery']);
});

test('simultaneous new leads are serialized without losing either delivery', async () => {
  const n = await notifier();
  await Promise.all([n.flushPendingNotifications('first'), n.flushPendingNotifications('second')]);
  assert.deepEqual(n.sent, ['first', 'second']);
  assert.equal(n.maximumActive(), 1);
});

test('a failed queue query does not poison subsequent new lead deliveries', async () => {
  const n = await notifier({ failFirstQuery: true });
  const results = await Promise.allSettled([n.flushPendingNotifications('first'), n.flushPendingNotifications('second')]);
  assert.equal(results[0].status, 'rejected'); assert.equal(results[1].status, 'fulfilled');
  assert.deepEqual(n.sent, ['second']);
});

test('unsuccessful delivery stays failed for a later explicit retry', async () => {
  const n = await notifier({ failDelivery: true });
  await n.flushPendingNotifications('new-lead');
  assert.deepEqual(n.sent, []); assert.deepEqual(n.failed, ['new-lead']);
});

test('database selection binds a UUID scope and keeps general retry filters', async () => {
  const calls = [];
  const database = await loadModule('lib/database-postgres.ts', {
    postgres: () => (strings, ...values) => { calls.push({ sql: strings.join('?'), values }); return []; },
    './lead-economics': {}, './booking-slots': {},
  }, { process: { env: { DATABASE_URL: 'postgres://example.invalid/test' } } });
  const id = '00000000-0000-4000-8000-000000000001';
  await database.pendingDeliveries(['webhook'], 20, id);
  await database.pendingDeliveries(['webhook'], 20);
  assert.match(calls[0].sql, /AND \(\?::uuid IS NULL OR o\.lead_id = \?::uuid\)/);
  assert.deepEqual(calls[0].values.slice(0, 2), [id, id]);
  assert.deepEqual(calls[1].values.slice(0, 2), [null, null]);
  for (const { sql } of calls) {
    assert.match(sql, /status IN \('pending', 'failed'\)/);
    assert.match(sql, /next_attempt_at <= now\(\)/);
    assert.match(sql, /attempts < CASE/);
  }
});

test('public lead handler scopes its after callback while admin retains general retry', async () => {
  const route = await readFile(new URL('../app/api/lead/route.ts', import.meta.url), 'utf8');
  const admin = await readFile(new URL('../app/api/admin/leads/route.ts', import.meta.url), 'utf8');
  assert.match(route, /await flushPendingNotifications\(lead\.id\)/);
  assert.doesNotMatch(route, /await flushPendingNotifications\(\)/);
  assert.match(admin, /await flushPendingNotifications\(\)/);
});

test('a real local POST schedules delivery only for its newly saved lead', async () => {
  const callbacks = [], queued = [], flushed = [];
  const id = '00000000-0000-4000-8000-000000000002';
  const route = await loadModule('api/lead/route.ts', {
    'next/server': { after: callback => callbacks.push(callback) },
    '../../lib/admin-auth': { requestClientKey: async () => 'synthetic-client' },
    '../../lib/notification-channels': { configuredDeliveryChannels: () => ['webhook'] },
    '@runtime/database': {
      BookingSlotUnavailableError: class extends Error {},
      databaseConfigured: () => true,
      consumeDatabaseRateLimit: async () => true,
      createLead: async () => ({ id, public_number: 1 }),
    },
    '../../lib/lead-notifications': {
      enqueueLeadNotifications: async value => queued.push(value),
      flushPendingNotifications: async value => flushed.push(value),
    },
  }, { Request, Response });
  const response = await route.POST(new Request('https://example.invalid/api/lead', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Synthetic test', contact: 'test@example.invalid', consent: 'yes' }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, number: 1 });
  assert.deepEqual(queued, [id]); assert.equal(callbacks.length, 1);
  await callbacks[0](); assert.deepEqual(flushed, [id]);
});
