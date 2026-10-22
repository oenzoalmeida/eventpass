import { DatabaseSync } from 'node:sqlite';
import type { DbClient, RunResult } from './client.js';

/**
 * Implementação SQLite da DbClient sobre o módulo nativo node:sqlite.
 * Versão de referência: arquivo único, sem servidor — alternativa de
 * recuperação caso a hospedagem Postgres precise ser abandonada.
 */
export class SqliteClient implements DbClient {
  readonly dialect = 'sqlite' as const;

  constructor(private readonly db: DatabaseSync) {}

  raw(): DatabaseSync {
    return this.db;
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (this.db.prepare(sql).get(...(params as never[])) as T) ?? null;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    // INSERT ... RETURNING devolve linhas; o node:sqlite só aceita em .get().
    if (/\bRETURNING\b/i.test(sql)) {
      const row = this.db.prepare(sql).get(...(params as never[])) as
        { id?: number | bigint } | undefined;
      return { insertId: Number(row?.id), rowCount: row ? 1 : 0 };
    }
    const result = this.db.prepare(sql).run(...(params as never[]));
    return { insertId: Number(result.lastInsertRowid), rowCount: Number(result.changes) };
  }

  async lock(): Promise<void> {
    // BEGIN IMMEDIATE já serializa escritores no SQLite.
  }

  async transaction<T>(fn: (tx: DbClient) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
