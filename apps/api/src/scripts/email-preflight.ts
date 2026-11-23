import { loadEnv } from '../env.js';
import { PgClient } from '../db/pg.js';
import { inspectEmailSchema } from '../lib/email/preflight.js';

/**
 * Read-only PostgreSQL compatibility diagnostic.
 * Never applies migrations or sends notifications. No secrets or records are printed.
 */
async function main() {
  const env = loadEnv();
  if (env.DATABASE_DIALECT !== 'postgres') {
    throw new Error('Email preflight is currently supported only for PostgreSQL');
  }
  const db = new PgClient(env.DATABASE_URL, { ssl: env.DATABASE_SSL ?? true });
  try {
    const result = await inspectEmailSchema(db);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 2;
  } finally {
    await db.close();
  }
}

main().catch(() => {
  console.error('Email schema preflight failed; check database connectivity and schema permissions.');
  process.exitCode = 1;
});
