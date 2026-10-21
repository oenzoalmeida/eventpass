import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { transaction, type Database } from '../db/database.js';
export const TABLES = [
  'admins',
  'sessions',
  'events',
  'participants',
  'registrations',
  'checkins',
  'point_entries',
] as const;
export type Snapshot = { version: 1; tables: Record<string, Record<string, unknown>[]> };
export async function snapshot(db: Database): Promise<Snapshot> {
  return transaction(db, async () => {
    await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables: Snapshot['tables'] = {};
    for (const table of TABLES)
      tables[table] = (await db.query('SELECT * FROM ' + table + ' ORDER BY id')).rows;
    return { version: 1, tables };
  });
}
export async function importSnapshot(db: Database, data: Snapshot) {
  if (data.version !== 1 || !data.tables || TABLES.some((t) => !Array.isArray(data.tables[t])))
    throw new Error('Invalid snapshot');
  return transaction(db, async () => {
    await db.exec('LOCK TABLE ' + TABLES.join(',') + ' IN ACCESS EXCLUSIVE MODE');
    for (const table of TABLES)
      if ((await db.query('SELECT 1 FROM ' + table + ' LIMIT 1')).rowCount)
        throw new Error('Destination must be empty; existing data is never overwritten');
    for (const table of TABLES) {
      const allowed = (
        await db.query(
          'SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1',
          [table],
        )
      ).rows.map((r) => r.column_name);
      for (const row of data.tables[table]!) {
        const cols = Object.keys(row);
        if (!cols.length || cols.some((c) => !allowed.includes(c)))
          throw new Error('Invalid snapshot columns');
        const values = cols.map((c) => row[c]);
        await db.query(
          'INSERT INTO ' +
            table +
            '(' +
            cols.join(',') +
            ') VALUES (' +
            cols.map((_, i) => '$' + (i + 1)).join(',') +
            ')',
          values,
        );
      }
      await db.query(
        "SELECT setval(pg_get_serial_sequence($1,'id'), COALESCE((SELECT max(id) FROM " +
          table +
          '),1), EXISTS(SELECT 1 FROM ' +
          table +
          '))',
        [table],
      );
    }
    const invalid = await db.query(
      'SELECT pe.id FROM point_entries pe JOIN checkins c ON c.id=pe.checkin_id JOIN registrations r ON r.id=c.registration_id WHERE pe.participant_id<>r.participant_id LIMIT 1',
    );
    if (invalid.rowCount) throw new Error('Point ownership mismatch');
  });
}
function key(hex: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(hex))
    throw new Error('BACKUP_KEY must be 32 random bytes encoded as hex');
  return Buffer.from(hex, 'hex');
}
export function encryptBackup(data: Snapshot, hex: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(hex), iv);
  cipher.setAAD(Buffer.from('eventpass-backup-v1'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from('EPB1'), iv, cipher.getAuthTag(), ciphertext]);
}
export function decryptBackup(data: Buffer, hex: string): Snapshot {
  if (data.subarray(0, 4).toString() !== 'EPB1') throw new Error('Invalid backup');
  const decipher = createDecipheriv('aes-256-gcm', key(hex), data.subarray(4, 16));
  decipher.setAAD(Buffer.from('eventpass-backup-v1'));
  decipher.setAuthTag(data.subarray(16, 32));
  return JSON.parse(
    Buffer.concat([decipher.update(data.subarray(32)), decipher.final()]).toString('utf8'),
  ) as Snapshot;
}
