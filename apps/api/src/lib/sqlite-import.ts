import { DatabaseSync } from 'node:sqlite';
import { TABLES, type Snapshot } from './data-transfer.js';
export function readSqliteSnapshot(file: string): Snapshot {
  const source = new DatabaseSync(file, { readOnly: true });
  try {
    source.exec('BEGIN');
    const tables: Snapshot['tables'] = {};
    for (const table of TABLES)
      tables[table] = source.prepare('SELECT * FROM ' + table + ' ORDER BY id').all();
    source.exec('COMMIT');
    return { version: 1, tables };
  } finally {
    source.close();
  }
}
