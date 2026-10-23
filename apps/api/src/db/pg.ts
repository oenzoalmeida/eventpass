import postgres, { type Sql } from 'postgres';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPgPlaceholders, type DbClient, type RunResult } from './client.js';

// Lazy: em bundle serverless (CJS) import.meta.url é undefined no topo do módulo.
const migrationsDir = () => join(dirname(fileURLToPath(import.meta.url)), '../../migrations-pg');

export interface PostgresOptions {
  /** SSL obrigatório para o Neon; desative só em Postgres local sem TLS. */
  ssl?: boolean;
  /** Preparo de statements: false (padrão) é obrigatório atrás do pooler do Neon. */
  prepare?: boolean;
}

/**
 * Implementação PostgreSQL (postgres.js) da DbClient, pensada para Neon e
 * ambientes serverless: pool pequeno, timeout de ociosidade curto e
 * prepared statements desligados por padrão (compatível com o pooler do Neon).
 *
 * Aceita uma conexão `Sql` existente para uso dentro de transações.
 */
export class PgClient implements DbClient {
  readonly dialect = 'postgres' as const;
  protected sql: Sql;

  constructor(urlOrSql: string | Sql, opts: PostgresOptions = {}) {
    this.sql =
      typeof urlOrSql === 'string'
        ? postgres(urlOrSql, {
            ssl: opts.ssl ?? true,
            prepare: opts.prepare ?? false,
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
            onnotice: () => {},
          })
        : urlOrSql;
  }

  /** Conexão bruta (usada por migrações com múltiplas instruções). */
  raw(): Sql {
    return this.sql;
  }

  private translate(sql: string): string {
    return toPgPlaceholders(sql);
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = (await this.sql.unsafe(this.translate(sql), params as never[])) as unknown[];
    return (rows[0] as T) ?? null;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const rows = (await this.sql.unsafe(this.translate(sql), params as never[])) as unknown as T[];
    return rows;
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    const rows = (await this.sql.unsafe(
      this.translate(sql),
      params as never[],
    )) as unknown as Array<{ id?: number }> & { count?: number };
    const first = rows[0];
    return { insertId: first?.id, rowCount: rows.count ?? rows.length };
  }

  async lock(key: number | string): Promise<void> {
    // Chave estável: ids numéricos direto, strings via hash simples.
    const k = typeof key === 'number' ? key : Math.abs(hash(key)) % 2 ** 31;
    await this.sql`SELECT pg_advisory_xact_lock(${k}::bigint)`;
  }

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    return this.sql.begin(async (tx) => fn(new PgTxClient(tx as never))) as unknown as Promise<T>;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

/** Client restrito à transação corrente: não abre nem fecha conexões. */
class PgTxClient extends PgClient {
  constructor(tx: Sql) {
    super(tx);
  }
  override async close(): Promise<void> {
    // Encerrar a conexão aqui derrubaria a transação; o commit/rollback é do sql.begin.
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** Aplica os arquivos NNN_nome.sql de migrations-pg ainda não registrados. */
export async function migratePostgres(
  client: PgClient,
  dir: string = migrationsDir(),
): Promise<string[]> {
  await client.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  )`);
  const applied = new Set(
    (await client.all<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name),
  );
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort();
  } catch {
    // Bundle serverless não inclui os .sql: nenhuma migração aplicável aqui.
    // Aplique com `npm run db:migrate` a partir do repositório.
    return [];
  }

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = readFileSync(join(dir, file), 'utf8');
    await client.transaction(async (tx) => {
      // Sem parâmetros usa o protocolo simples: várias instruções por arquivo.
      await (tx as PgClient).raw().unsafe(sqlText);
      await tx.run('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    });
    ran.push(file);
  }
  return ran;
}
