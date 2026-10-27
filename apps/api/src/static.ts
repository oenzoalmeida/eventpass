import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

/**
 * Em produção, a API também serve o frontend compilado (apps/web/dist),
 * permitindo rodar tudo em um único processo e porta.
 * Rotas desconhecidas fora de /api devolvem o index.html (SPA).
 * O import é dinâmico: no bundle serverless (Vercel) o @fastify/static não
 * participa do cold start — seu require CJS de dependências ESM-only
 * causava ERR_REQUIRE_ESM na função.
 */
export async function serveWeb(app: FastifyInstance, distDir: string) {
  const root = resolve(distDir);
  if (!existsSync(resolve(root, 'index.html'))) {
    app.log.warn({ root }, 'frontend compilado não encontrado; rode npm run build');
    return;
  }
  const { default: fastifyStatic } = await import('@fastify/static');
  await app.register(fastifyStatic, { root, wildcard: false, maxAge: '1h' });
  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET' || request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'not_found', message: 'Rota não encontrada.' });
    }
    return reply.header('cache-control', 'no-cache').sendFile('index.html');
  });
}
