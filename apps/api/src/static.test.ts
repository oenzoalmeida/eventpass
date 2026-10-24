import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { migrate, openDatabase } from './db/database.js';

let app: FastifyInstance;
afterEach(async () => app.close());

describe('servindo o frontend', () => {
  it('entrega o index.html para rotas da SPA e 404 JSON para /api', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'ep-web-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>EventPass</title>');
    const db = openDatabase(':memory:');
    migrate(db);
    app = await buildApp(loadEnv({ NODE_ENV: 'test', WEB_DIST: dist }), db);

    const page = await app.inject({ method: 'GET', url: '/e/algum-evento' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('EventPass');
    expect(page.headers['content-security-policy']).toContain("default-src 'self'");

    const privateRoutes = ['/admin', '/admin/eventos', '/ingresso/token-ficticio?origem=teste'];
    for (const url of privateRoutes) {
      const privatePage = await app.inject({ method: 'GET', url });
      expect(privatePage.statusCode).toBe(200);
      expect(privatePage.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
      expect(privatePage.headers['cache-control']).toBe('no-store');
    }

    expect(page.headers['x-robots-tag']).toBeUndefined();

    const api = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(api.statusCode).toBe(404);
    expect(api.json().error).toBe('not_found');
  });
});
