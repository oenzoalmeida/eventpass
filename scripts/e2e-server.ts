import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { openTestDatabase } from '../apps/api/src/db/test-database.js';
import { seedAdmin } from '../apps/api/src/test-utils.js';
import { loadEnv } from '../apps/api/src/env.js';
import { createHandler } from '../api/index.js';
const db = await openTestDatabase();
await seedAdmin(db);
const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  WEB_ORIGIN: 'http://127.0.0.1:3334',
  WEB_DIST: resolve('apps/web/dist'),
});
const server = createServer(createHandler(env, db));
server.listen(3334, '127.0.0.1');
const shutdown = () => {
  server.close(() => {
    void db.close().then(() => process.exit(0));
  });
  server.closeAllConnections();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
