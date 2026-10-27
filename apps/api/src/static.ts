import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

/**
 * Em produção, a API também serve o frontend compilado (apps/web/dist),
 * permitindo rodar tudo em um único processo e porta.
 * Rotas desconhecidas fora de /api devolvem o index.html (SPA).
 */
export async function serveWeb(app: FastifyInstance, distDir: string) {
  const root = resolve(distDir);
  if (!existsSync(resolve(root, 'index.html'))) {
    app.log.warn({ root }, 'frontend compilado não encontrado; rode npm run build');
    return;
  }
  await app.register(fastifyStatic, { root, wildcard: false, maxAge: '1h' });
  app.addHook('onSend', async (request, reply, payload) => {
    const path = request.url.split('?')[0] ?? '';
    if (path === '/admin' || path.startsWith('/admin/') || path === '/ingresso' || path.startsWith('/ingresso/')) {
      reply.header('x-robots-tag', 'noindex, nofollow, noarchive');
      reply.header('cache-control', 'no-store');
    }
    return payload;
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'not_found', message: 'Rota não encontrada.' });
    }
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
}
