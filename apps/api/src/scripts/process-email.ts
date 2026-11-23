import { loadEnv } from '../env.js';
import { processEmailBatch } from './email-worker.js';

/** Explicit one-shot worker for the approved, configured server deployment. */
async function main() {
  const env = loadEnv();
  const count = await processEmailBatch(env, 20);
  console.log(`Email worker completed. Jobs handled: ${count}.`);
}

main().catch(() => {
  console.error('Email worker failed; review configuration and test logs.');
  process.exitCode = 1;
});
