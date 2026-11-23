import type { Config } from '@netlify/functions';
import { loadEnv } from '../../src/env.js';
import { openDb } from '../../src/db/index.js';
import { pruneEmailData } from '../../src/lib/email/maintenance.js';

/** Separate daily retention job, opt-in and never sends mail. */
export default async function handler(): Promise<void> {
  if (process.env.EMAIL_MAINTENANCE_ENABLED !== 'true') return;
  const env = loadEnv({ ...process.env, NODE_ENV: 'production', EMAIL_ENABLED: 'false', DB_AUTO_MIGRATE: 'false' });
  if (env.DATABASE_DIALECT !== 'postgres') throw new Error('Scheduled retention requires PostgreSQL');
  const { db } = await openDb(env, { connectTimeoutSeconds: 3, statementTimeoutMs: 1000, lockTimeoutMs: 1000, maxConnections: 1 });
  try { console.info(JSON.stringify(await pruneEmailData(db))); }
  catch { throw new Error('Email retention failed. Sensitive details suppressed.'); }
  finally { await db.close(); }
}
export const config: Config = { schedule: '17 3 * * *' };
