const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { start } = require('../src/index');

test('booking flow persists data and rejects invalid input', async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const server = await start({ pool, port: 0, host: '127.0.0.1' });
  const cleanup = [];
  t.after(async () => {
    for (const remove of cleanup) await remove();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = body => fetch(`${base}/api/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await fetch(`${base}/health`)).status, 200);
  for (const body of [null, {}, { name: 'Test', email: 'bad', slot: 'bad' },
    { name: 'Test', email: 'test@example.com', slot: 'bad' },
    { name: 'Test', email: 'test@example.com', slot: '2027-02-30T10:00:00Z' }]) {
    assert.equal((await post(body)).status, 400);
  }
  const email = `test-${crypto.randomUUID()}@example.com`;
  cleanup.push(() => pool.query('DELETE FROM clients WHERE email = $1', [email]));
  for (let i = 0; i < 2; i++) {
    const response = await post({ name: 'Test Client', email, slot: '2027-12-01T10:00:00Z' });
    assert.equal(response.status, 201);
    assert.ok((await response.json()).id);
  }
  const rows = await (await fetch(`${base}/api/bookings`)).json();
  assert.equal(rows.filter(row => row.email === email).length, 2);
  const clients = await pool.query('SELECT id FROM clients WHERE email = $1', [email]);
  assert.equal(clients.rowCount, 1);
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
  const malformed = await fetch(`${base}/api/bookings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
});

test('database failures produce a safe error response', async (t) => {
  const { createApp } = require('../src/app');
  const app = createApp({ query: async () => { throw new Error('private database detail'); } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/health', '/api/bookings']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Internal server error' });
  }
});
