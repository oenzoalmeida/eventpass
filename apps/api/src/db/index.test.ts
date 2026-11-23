import { describe, expect, it } from 'vitest';
import { openDb } from './index.js';
import { loadEnv } from '../env.js';

describe('SQLite migration guard', () => {
  it('does not change a new production database without explicit approval', async () => {
    const env = loadEnv({
      NODE_ENV: 'production', DATABASE_DIALECT: 'sqlite',
      DATABASE_URL: ':memory:', DB_AUTO_MIGRATE: 'false',
    });
    await expect(openDb(env)).rejects.toThrow('Aplique as migrações primeiro');
  });

  it('allows explicit migration in isolated SQLite tests', async () => {
    const env = loadEnv({
      NODE_ENV: 'test', DATABASE_DIALECT: 'sqlite',
      DATABASE_URL: ':memory:', DB_AUTO_MIGRATE: 'true',
    });
    const { db, applied } = await openDb(env);
    try {
      expect(applied).toContain('004_ticket_recovery.sql');
      const rows = await db.all<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name');
      expect(rows).toHaveLength(5);
    } finally {
      await db.close();
    }
  });
});
