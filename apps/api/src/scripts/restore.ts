import { readFile } from 'node:fs/promises';
import { loadEnv } from '../env.js';
import { openDatabase, migrate } from '../db/database.js';
import { decryptBackup, importSnapshot } from '../lib/data-transfer.js';
if (process.env.RESTORE_CONFIRM !== 'empty-database' || !process.env.BACKUP_FILE)
  throw new Error('Restore requires BACKUP_FILE and RESTORE_CONFIRM=empty-database');
const env = loadEnv();
const db = openDatabase(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL);
try {
  const data = decryptBackup(await readFile(process.env.BACKUP_FILE), process.env.BACKUP_KEY ?? '');
  await migrate(db);
  await importSnapshot(db, data);
  console.log('Backup restored into empty database.');
} finally {
  await db.close();
}
