const express = require('express');

async function initialize(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      slot TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function validSlot(slot) {
  if (typeof slot !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(slot)) return false;
  const date = new Date(slot);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === slot.slice(0, 19);
}

function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });
  app.get('/api/bookings', async (_req, res) => {
    const { rows } = await pool.query(`
      SELECT b.id, b.slot, b.created_at, c.name, c.email
      FROM bookings b JOIN clients c ON c.id = b.client_id
      ORDER BY b.created_at DESC, b.id DESC
    `);
    res.json(rows);
  });
  app.post('/api/bookings', async (req, res) => {
    const { name, email, slot } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 200 ||
      typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validSlot(slot)) {
      return res.status(400).json({ error: 'Provide a name, valid email, and ISO UTC booking time.' });
    }
    const { rows } = await pool.query(`
      WITH client AS (
        INSERT INTO clients (name, email) VALUES ($1, $2)
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      )
      INSERT INTO bookings (client_id, slot) SELECT id, $3 FROM client
      RETURNING id, slot, created_at
    `, [name.trim(), email.toLowerCase(), slot]);
    res.status(201).json(rows[0]);
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, _next) => {
    const status = error.status === 400 || error.status === 413 ? error.status : 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : 'Invalid JSON request body' });
  });
  return app;
}

module.exports = { createApp, initialize };
