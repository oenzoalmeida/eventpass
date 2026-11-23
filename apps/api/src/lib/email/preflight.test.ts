import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from '../../db/database.js';
import { SqliteClient } from '../../db/sqlite-client.js';
import { inspectEmailSchema } from './preflight.js';

describe('email schema preflight', () => {
  it('recognizes a fully migrated disposable SQLite database', async () => {
    const sqlite = openDatabase(':memory:');
    migrate(sqlite);
    const db = new SqliteClient(sqlite);
    try {
      expect(await inspectEmailSchema(db)).toEqual({
        ready: true,
        missingMigrations: [],
        missingTables: [],
        missingAdminPasswordColumn: false,
      });
    } finally {
      await db.close();
    }
  });
  it('detects missing mail tables and migrations without changing schema', async () => {
    const sqlite = openDatabase(':memory:');
    sqlite.exec("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY)");
    sqlite.exec("INSERT INTO schema_migrations (name) VALUES ('001_initial.sql')");
    sqlite.exec("CREATE TABLE admins (id INTEGER PRIMARY KEY, email TEXT)");
    const db = new SqliteClient(sqlite);
    try {
      const before = (await db.all<{ name: string }>("SELECT name FROM schema_migrations")).length;
      const result = await inspectEmailSchema(db);
      expect(result.ready).toBe(false);
      expect(result.missingMigrations).toContain('002_password_change.sql');
      expect(result.missingTables).toContain('email_outbox');
      expect(result.missingAdminPasswordColumn).toBe(true);
      expect((await db.all<{ name: string }>("SELECT name FROM schema_migrations")).length).toBe(before);
    } finally {
      await db.close();
    }
  });
});
