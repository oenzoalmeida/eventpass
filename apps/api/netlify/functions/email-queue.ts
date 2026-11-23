import type { Config } from '@netlify/functions';
import { loadEnv } from '../../src/env.js';
import { processEmailBatch } from '../../src/scripts/email-worker.js';

/**
 * Netlify Scheduled Function: runs only on a published deploy, never on previews.
 * EMAIL_ENABLED=false is the default and prevents database access or sending.
 * Max two jobs per invocation to stay below the platform execution limit.
 */
export default async function handler(): Promise<void> {
  const env = loadEnv({ ...process.env, NODE_ENV: 'production' });
  if (!env.EMAIL_ENABLED) return;
  if (env.DATABASE_DIALECT !== 'postgres') {
    throw new Error('Netlify email worker requires PostgreSQL');
  }
  try {
    const processed = await processEmailBatch(env, 2);
    console.info(`Email worker: processed ${processed} job(s).`);
  } catch {
    console.error('Email worker encountered an error. Sensitive details suppressed.');
    throw new Error('Email worker batch failed');
  }
}

export const config: Config = {
  schedule: '*/5 * * * *',
};
