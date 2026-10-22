import type { Env } from '../env.js';
import type { DbClient } from './client.js';
import { SqliteClient } from './sqlite-client.js';
import { PgClient, migratePostgres } from './pg.js';
import { openDatabase, migrate as migrateSqlite } from './database.js';

export type { DbClient } from './client.js';
export { SqliteClient, PgClient };
export { openDatabase, migrate as migrateSqlite } from './database.js';

/**
 * Abre o cliente conforme DATABASE_DIALECT e aplica migrações pendentes.
 * SQLite continua sendo a versão de referência; PostgreSQL é usado na
 * homologação Neon/Netlify.
 */
export async function openDb(env: Env): Promise<{ db: DbClient; applied: string[] }> {
  if (env.DATABASE_DIALECT === 'postgres') {
    const pg = new PgClient(env.DATABASE_URL, { ssl: env.DATABASE_SSL ?? true });
    const applied = await migratePostgres(pg);
    return { db: pg, applied };
  }
  const sqlite = new SqliteClient(openDatabase(env.DATABASE_URL));
  const applied = migrateSqlite(sqlite.raw());
  return { db: sqlite, applied };
}
