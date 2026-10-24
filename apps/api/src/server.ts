import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { openDb } from './db/index.js';

// Servidor tradicional (SQLite ou Postgres). Na homologação Netlify, quem
// atende as requisições é netlify/functions/api.ts usando o mesmo buildApp.
const env = loadEnv();
const { db, applied } = await openDb(env);

const app = await buildApp(env, db);
if (applied.length) app.log.info({ applied }, 'migrações aplicadas');

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
