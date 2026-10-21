import { AsyncLocalStorage } from 'node:async_hooks';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

// API contracts use numeric IDs/counts. Reject overflow instead of losing precision.
pg.types.setTypeParser(20, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Integer exceeds API range');
  return n;
});
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../migrations-postgres');
export class Database {
  readonly pool: pg.Pool;
  private readonly context = new AsyncLocalStorage<pg.PoolClient>();
  constructor(url: string, schema?: string) {
    if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('DATABASE_URL must be a PostgreSQL URL');
    if (schema && !/^ep_test_[a-f0-9]+$/.test(schema)) throw new Error('Invalid test schema');
    this.pool = new pg.Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      ...(schema ? { options: '-c search_path=' + schema } : {}),
    });
    this.pool.on('error', () => {
      /* Never log connection strings or query parameters. */
    });
    if (process.env.VERCEL) attachDatabasePool(this.pool);
  }
  async query(sql: string, params: unknown[] = []) {
    return (this.context.getStore() ?? this.pool).query(sql, params);
  }
  prepare(sql: string) {
    let i = 0;
    const statement = sql.replace(/\?/g, () => '$' + ++i);
    return {
      get: async (...params: unknown[]) => (await this.query(statement, params)).rows[0] as unknown,
      all: async (...params: unknown[]) => (await this.query(statement, params)).rows as unknown[],
      run: async (...params: unknown[]) => {
        const returning =
          /^\s*INSERT\s+INTO\s+(admins|sessions|events|participants|registrations|checkins|point_entries)\b/i.test(
            statement,
          ) && !/\bRETURNING\b/i.test(statement);
        const result = await this.query(statement + (returning ? ' RETURNING id' : ''), params);
        return { lastInsertRowid: result.rows[0]?.id as number, changes: result.rowCount ?? 0 };
      },
    };
  }
  async exec(sql: string) {
    await this.query(sql);
  }
  async close() {
    await this.pool.end();
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) throw new Error('Nested transaction not supported');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '25s'");
      const result = await this.context.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
export const openDatabase = (url: string, schema?: string) => new Database(url, schema);
export const transaction = <T>(db: Database, fn: () => Promise<T>) => db.transaction(fn);
export async function migrate(db: Database, dir = MIGRATIONS_DIR): Promise<string[]> {
  return db.transaction(async () => {
    await db.query('SELECT pg_advisory_xact_lock(708412021)');
    await db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const applied = new Set(
      (await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
    );
    const ran: string[] = [];
    for (const file of (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort()) {
      if (applied.has(file)) continue;
      await db.exec(await readFile(join(dir, file), 'utf8'));
      await db.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      ran.push(file);
    }
    return ran;
  });
}
