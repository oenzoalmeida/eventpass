import { loadEnv } from '../env.js';
import { openDatabase, migrate } from '../db/database.js';
import { importSnapshot } from '../lib/data-transfer.js';
import { readSqliteSnapshot } from '../lib/sqlite-import.js';
if (!process.env.SQLITE_SOURCE) throw new Error('SQLITE_SOURCE required');
const env = loadEnv();
const db = openDatabase(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL);
try {
  const data = readSqliteSnapshot(process.env.SQLITE_SOURCE);
  await migrate(db);
  await importSnapshot(db, data);
  console.log('SQLite imported without modifying the source.');
} finally {
  await db.close();
}
