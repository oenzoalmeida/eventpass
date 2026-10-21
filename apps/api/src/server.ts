import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { openDatabase } from './db/database.js';
const env = loadEnv();
const db = openDatabase(env.DATABASE_URL);

const app = await buildApp(env, db);

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
