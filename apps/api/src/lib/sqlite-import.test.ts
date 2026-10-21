import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { readSqliteSnapshot } from './sqlite-import.js';
import { importSnapshot, snapshot } from './data-transfer.js';
import { openTestDatabase } from '../db/test-database.js';
it('imports a read-only SQLite fixture and preserves the original bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eventpass-import-'));
  const file = join(directory, 'source.db');
  const sqlite = new DatabaseSync(file);
  sqlite.exec(await readFile(new URL('../../migrations/001_initial.sql', import.meta.url), 'utf8'));
  sqlite.exec(
    "INSERT INTO admins(id,email,name,password_hash) VALUES(12,'a@x.test','Admin','original-hash'); INSERT INTO participants(id,email,name) VALUES(15,'p@x.test','Pessoa')",
  );
  sqlite.close();
  const before = await readFile(file);
  const data = readSqliteSnapshot(file);
  const target = await openTestDatabase();
  try {
    await importSnapshot(target, data);
    expect(await snapshot(target)).toEqual(data);
    expect(await readFile(file)).toEqual(before);
  } finally {
    await target.close();
  }
});
