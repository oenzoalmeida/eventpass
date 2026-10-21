import { openTestDatabase } from './db/test-database.js';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';

let app: FastifyInstance;
afterEach(async () => app.close());
describe('servindo o frontend', () => {
  it('entrega o index.html para rotas da SPA e 404 JSON para /api', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'ep-web-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>EventPass</title>');
    const db = await openTestDatabase();

    app = await buildApp(
      loadEnv({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL, WEB_DIST: dist }),
      db,
    );
    app.addHook('onClose', async () => db.close());
    const page = await app.inject({ method: 'GET', url: '/e/algum-evento' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('EventPass');
    expect(page.headers['content-security-policy']).toContain("default-src 'self'");
    const api = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(api.statusCode).toBe(404);
    expect(api.json().error).toBe('not_found');
  });
});
