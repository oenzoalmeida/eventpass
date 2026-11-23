import type { DbClient } from '../../db/client.js';
import { PG_MIGRATIONS } from '../../db/pg-migrations.js';

export interface EmailSchemaPreflight {
  ready: boolean;
  missingMigrations: string[];
  missingTables: string[];
  missingAdminPasswordColumn: boolean;
}

/**
 * Read-only preflight for email/recovery deployment. It never changes the database.
 * A clean result is necessary but not sufficient for production activation.
 */
export async function inspectEmailSchema(db: DbClient): Promise<EmailSchemaPreflight> {
  const migrations = await db.all<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set(migrations.map((item) => item.name));
  const missingMigrations = PG_MIGRATIONS.filter((name) => !applied.has(name));
  const expectedTables = ['email_outbox', 'ticket_recovery_requests'];
  const existingTables = new Set(
    db.dialect === 'postgres'
      ? (await db.all<{ name: string }>(
          "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('email_outbox','ticket_recovery_requests')",
        )).map((row) => row.name)
      : (await db.all<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('email_outbox','ticket_recovery_requests')",
        )).map((row) => row.name),
  );
  const missingTables = expectedTables.filter((table) => !existingTables.has(table));
  const passwordColumn = db.dialect === 'postgres'
    ? await db.get<{ name: string }>(
        "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'admins' AND column_name = 'must_change_password'",
      )
    : (await db.all<{ name: string }>("PRAGMA table_info(admins)"))
        .find((row) => row.name === 'must_change_password');
  const missingAdminPasswordColumn = !passwordColumn;
  return {
    ready: missingMigrations.length === 0 && missingTables.length === 0 && !missingAdminPasswordColumn,
    missingMigrations,
    missingTables,
    missingAdminPasswordColumn,
  };
}
