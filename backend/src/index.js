const { Pool } = require('pg');
const { createApp, initialize } = require('./app');

async function start({ pool, port = process.env.PORT || 4000, host = '0.0.0.0' }) {
  await initialize(pool);
  const app = createApp(pool);
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.once('error', reject);
  });
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  start({ pool }).then(server => {
    console.log('LocalLaunch backend ready');
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => server.close(() => pool.end()));
    }
  }).catch(async error => {
    console.error('Database initialization or startup failed:', error.message);
    await pool.end();
    process.exitCode = 1;
  });
}

module.exports = { start };
