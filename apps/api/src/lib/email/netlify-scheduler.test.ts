import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../env.js';
import { processEmailBatch } from '../../scripts/email-worker.js';
import handler, { config } from '../../../netlify/functions/email-queue.js';

describe('Netlify scheduled email worker safety', () => {
  it('uses a bounded cron schedule', () => {
    expect(config.schedule).toBe('*/5 * * * *');
  });

  it('does nothing with mail disabled without requiring database credentials', async () => {
    const env = loadEnv({
      NODE_ENV: 'test', EMAIL_ENABLED: 'false', DATABASE_DIALECT: 'postgres',
      DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unavailable',
    });
    expect(await processEmailBatch(env, 2)).toBe(0);
  });

  it('returns immediately on Netlify when EMAIL_ENABLED is unset', async () => {
    const saved = process.env.EMAIL_ENABLED;
    delete process.env.EMAIL_ENABLED;
    try {
      await expect(handler()).resolves.toBeUndefined();
    } finally {
      if (saved === undefined) delete process.env.EMAIL_ENABLED;
      else process.env.EMAIL_ENABLED = saved;
    }
  });
});
