import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '../db/database.js';

const dir = mkdtempSync(join(tmpdir(), 'eventpass-backup-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('backup do banco', () => {
  it('cria cópia consistente com VACUUM INTO e o arquivo abre e lê os dados', () => {
    const mainPath = join(dir, 'main.db');
    const db = openDatabase(mainPath);
    migrate(db);
    db.prepare('INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)').run(
      'a@exemplo.test',
      'A',
      'scrypt$131072$8$1$eA==$eA==',
    );

    const backupPath = join(dir, 'backup.db');
    db.prepare('VACUUM INTO ?').run(backupPath);
    expect(
      (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check,
    ).toBe('ok');
    db.close();

    const copy = openDatabase(backupPath);
    const row = copy.prepare('SELECT email, name FROM admins').get() as { email: string };
    expect(row.email).toBe('a@exemplo.test');
    copy.close();
  });
});
