import { DatabaseSync } from 'node:sqlite';
import type { DbClient, RunResult } from './client.js';

/**
 * Implementação SQLite da DbClient sobre o módulo nativo node:sqlite.
 * Versão de referência: arquivo único, sem servidor — alternativa de
 * recuperação caso a hospedagem Postgres precise ser abandonada.
 */
export class SqliteClient implements DbClient {
  readonly dialect = 'sqlite' as const;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(private readonly db: DatabaseSync, private readonly inTransaction = false) {}

  raw(): DatabaseSync {
    return this.db;
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (!this.inTransaction) await this.transactionTail;
    return (this.db.prepare(sql).get(...(params as never[])) as T) ?? null;
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.inTransaction) await this.transactionTail;
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    if (!this.inTransaction) await this.transactionTail;
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
    if (this.inTransaction) throw new Error('Nested SQLite transactions are not supported');
    // Async callbacks yield between queries. Queue transactions on this shared
    // connection so concurrent requests cannot issue a nested BEGIN.
    const previous = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    let began = false;
    try {
      this.db.exec('BEGIN IMMEDIATE');
      began = true;
      const result = await fn(new SqliteClient(this.db, true));
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      if (began) this.db.exec('ROLLBACK');
      throw err;
    } finally {
      release();
    }
  }

  async close(): Promise<void> {
    if (this.inTransaction) return;
    await this.transactionTail;
    this.db.close();
  }
}
