/**
 * Interface assíncrona de acesso ao banco, com duas implementações:
 * SQLite (`sqlite-client.ts`, versão de referência) e PostgreSQL (`pg.ts`,
 * compatível com Neon e ambientes serverless).
 *
 * As consultas são escritas com placeholders `?`; a implementação de Postgres
 * converte para `$1, $2…`.
 */
export type DbDialect = 'sqlite' | 'postgres';

export interface RunResult {
  /** Id da linha inserida; presente quando a instrução usa RETURNING id. */
  insertId?: number;
  rowCount: number;
}

export interface DbClient {
  readonly dialect: DbDialect;
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  /**
   * Serializa transações concorrentes na mesma chave (controle de vagas,
   * idempotência do check-in). Em Postgres usa pg_advisory_xact_lock;
   * em SQLite é no-op porque BEGIN IMMEDIATE já serializa escritores.
   * Só é garantida dentro de `transaction`.
   */
  lock(key: number | string): Promise<void>;
  transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Converte placeholders `?` para `$1, $2…` (dialeto Postgres). */
export function toPgPlaceholders(sql: string): string {
  let out = '';
  let n = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    if (ch === "'" || ch === '"') {
      // Copia literais de string sem interpretar '?' dentro deles.
      const quote = ch;
      out += ch;
      while (i + 1 < sql.length) {
        out += sql[++i];
        if (sql[i] === quote) break;
      }
    } else if (ch === '?') {
      out += `$${++n}`;
    } else {
      out += ch;
    }
  }
  return out;
}
