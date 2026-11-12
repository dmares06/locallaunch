import assert from 'node:assert/strict';
const base = process.env.BASE_URL;
const page = await fetch(base);
assert.equal(page.status, 200);
assert.ok((await page.text()).includes('<form'));
async function request(path, body) {
  const response = await fetch(base + path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : {});
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}
const email = `smoke-${crypto.randomUUID()}@example.com`;
const booking = await request('/api/bookings', { name: 'Smoke Test', email, slot: '2027-12-01T10:00:00Z' });
assert.ok((await request('/api/bookings')).some(row => row.id === booking.id && row.email === email));
console.log('PASS: frontend serves HTML and proxies booking creation/listing');
