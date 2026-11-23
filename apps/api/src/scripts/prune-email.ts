import { loadEnv } from '../env.js';
import { openDb } from '../db/index.js';
import { pruneEmailData } from '../lib/email/maintenance.js';

/** Explicit maintenance only. Does not instantiate a provider or send messages. */
async function main() {
  const { db } = await openDb(loadEnv());
  try { console.log(JSON.stringify(await pruneEmailData(db))); }
  finally { await db.close(); }
}
main().catch(() => {
  console.error('Email retention maintenance failed. Sensitive details suppressed.');
  process.exitCode = 1;
});
