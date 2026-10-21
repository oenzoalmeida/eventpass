import { writeFile } from 'node:fs/promises';
import { loadEnv } from '../env.js';
import { openDatabase } from '../db/database.js';
import { snapshot, encryptBackup } from '../lib/data-transfer.js';
const output = process.env.BACKUP_FILE;
if (!output) throw new Error('BACKUP_FILE required');
const env = loadEnv();
const db = openDatabase(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL);
try {
  await writeFile(output, encryptBackup(await snapshot(db), process.env.BACKUP_KEY ?? ''), {
    flag: 'wx',
    mode: 0o600,
  });
  console.log('Encrypted backup created.');
} finally {
  await db.close();
}
