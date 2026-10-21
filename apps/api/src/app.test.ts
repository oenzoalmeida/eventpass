import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@eventpass/shared';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';

describe('GET /api/health', () => {
  it('responde com status ok no formato compartilhado', async () => {
    const app = await buildApp(loadEnv({ NODE_ENV: 'test' }));
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.safeParse(res.json()).success).toBe(true);
    await app.close();
  });
});
