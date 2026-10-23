import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Env } from '../env.js';
import type { DbClient } from './client.js';
import { SqliteClient } from './sqlite-client.js';
import { PgClient, migratePostgres } from './pg.js';
import { openDatabase, migrate as migrateSqlite } from './database.js';

export type { DbClient } from './client.js';
export { SqliteClient, PgClient };
export { openDatabase, migrate as migrateSqlite } from './database.js';

const PG_MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../migrations-pg');

/**
 * Abre o cliente conforme DATABASE_DIALECT.
 *
 * Migrações automáticas na inicialização (server.ts e Netlify Function):
 * controladas por DB_AUTO_MIGRATE — ligado fora de produção, desligado em
 * produção por padrão. Com a execução automática desligada, o banco é apenas
 * VERIFICADO: se faltar migração, o processo falha com instrução clara em
 * vez de alterar o schema silenciosamente.
 */
export async function openDb(env: Env): Promise<{ db: DbClient; applied: string[] }> {
  if (env.DATABASE_DIALECT === 'postgres') {
    const pg = new PgClient(env.DATABASE_URL, { ssl: env.DATABASE_SSL ?? true });
    if (env.DB_AUTO_MIGRATE) {
      const applied = await migratePostgres(pg);
      return { db: pg, applied };
    }
    await assertMigrationsUpToDate(
      pg,
      PG_MIGRATIONS_DIR,
      'npm run db:migrate (com DATABASE_DIALECT=postgres) ou defina DB_AUTO_MIGRATE=true',
    );
    return { db: pg, applied: [] };
  }
  const sqlite = new SqliteClient(openDatabase(env.DATABASE_URL));
  const applied = migrateSqlite(sqlite.raw());
  return { db: sqlite, applied };
}

/** Falha rápido se o banco não está na versão do código. */
async function assertMigrationsUpToDate(db: DbClient, dir: string, hint: string): Promise<void> {
  const files = readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
  const appliedRows = await db
    .all<{ name: string }>('SELECT name FROM schema_migrations')
    .catch(() => null);
  if (!appliedRows) {
    throw new Error(`Banco sem tabela schema_migrations. Aplique as migrações primeiro: ${hint}`);
  }
  const applied = new Set(appliedRows.map((r) => r.name));
  const missing = files.filter((f) => !applied.has(f));
  if (missing.length) {
    throw new Error(`Migrações pendentes no banco (${missing.join(', ')}). Aplique com: ${hint}`);
  }
}

/** Usado pelo script migrate.ts, que aplica migrações explicitamente. */
export async function migrateDb(env: Env): Promise<{ db: DbClient; applied: string[] }> {
  if (env.DATABASE_DIALECT === 'postgres') {
    const pg = new PgClient(env.DATABASE_URL, { ssl: env.DATABASE_SSL ?? true });
    return { db: pg, applied: await migratePostgres(pg) };
  }
  const sqlite = new SqliteClient(openDatabase(env.DATABASE_URL));
  return { db: sqlite, applied: migrateSqlite(sqlite.raw()) };
}
