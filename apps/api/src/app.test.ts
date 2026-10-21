import { afterEach, describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@eventpass/shared';
import { setupTestApp } from './test-utils.js';

let close: (() => Promise<void>) | undefined;
afterEach(async () => close?.());

describe('GET /api/health', () => {
  it('responde com status ok no formato compartilhado', async () => {
    const { app } = await setupTestApp();
    close = () => app.close();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.safeParse(res.json()).success).toBe(true);
  });
});
