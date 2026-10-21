import { randomBytes } from 'node:crypto';
import { openDatabase, migrate } from './database.js';
export async function openTestDatabase() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL required; use a disposable PostgreSQL database');
  const schema = 'ep_test_' + randomBytes(12).toString('hex');
  const admin = openDatabase(url);
  await admin.exec('CREATE SCHEMA ' + schema);
  const db = openDatabase(url, schema);
  const close = db.close.bind(db);
  db.close = async () => {
    await close();
    // Only this randomly named test schema is removed. No existing application data is touched.
    await admin.exec('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.close();
  };
  await migrate(db);
  return db;
}
