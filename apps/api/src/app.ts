import { HttpError } from './lib/http.js';
import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import type {} from '@fastify/rate-limit';
import { createHash } from 'node:crypto';
import type { Env } from './env.js';
import type { Database } from './db/database.js';

import { loadAdmin } from './auth/plugin.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { adminEventRoutes } from './routes/admin-events.js';
import { adminAttendanceRoutes } from './routes/admin-attendance.js';
import { publicRoutes } from './routes/public.js';
import { serveWeb } from './static.js';
export async function buildApp(env: Env, db: Database) {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
    trustProxy: (_address, hop) => env.NODE_ENV === 'production' && hop < 1,
    disableRequestLogging: true,
    bodyLimit: 65536,
  });
  app.decorate('db', db);
  app.decorateRequest('admin', null);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        // QR Code é SVG inline; imagens data: cobrem ícones gerados.
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
      },
    },
  });
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  app.addHook('preHandler', async (request, reply) => {
    const config = request.routeOptions.config.rateLimit;
    if (!config || typeof config !== 'object') return;
    const max = Number(config.max);
    const windowMs =
      typeof config.timeWindow === 'number'
        ? config.timeWindow
        : Number(String(config.timeWindow).split(' ')[0]) *
          (String(config.timeWindow).includes('minute') ? 60000 : 1000);
    const windowId = Math.floor(Date.now() / windowMs);
    const key = createHash('sha256')
      .update(request.routeOptions.url + ':' + request.ip)
      .digest('hex');
    const result = await db.query(
      'INSERT INTO rate_limits(key, window_id, hits, expires_at) VALUES ($1,$2,1,$3) ON CONFLICT (key,window_id) DO UPDATE SET hits = rate_limits.hits + 1 RETURNING hits',
      [key, windowId, new Date((windowId + 1) * windowMs)],
    );
    // Limpeza oportunista: sem cron no serverless, evita crescimento ilimitado
    // de sessões expiradas e janelas de rate limit antigas.
    if (Math.random() < 0.02) {
      await db.query('DELETE FROM rate_limits WHERE expires_at <= now()');
      await db.query('DELETE FROM sessions WHERE expires_at <= now()');
    }
    if (result.rows[0].hits > max)
      return reply
        .code(429)
        .header('retry-after', String(Math.ceil(((windowId + 1) * windowMs - Date.now()) / 1000)))
        .send({ error: 'rate_limited', message: 'Muitas tentativas. Aguarde e tente novamente.' });
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof HttpError) return reply.code(error.statusCode).send(error.payload);
    const status =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 500
        ? error.statusCode
        : 500;
    request.log.error({ code: error.code, status }, 'request failed');
    return reply.code(status).send({
      error: status === 500 ? 'internal_error' : 'invalid_request',
      message: status === 500 ? 'Erro interno. Tente novamente.' : 'Requisição inválida.',
    });
  });
  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'no-store').header('referrer-policy', 'no-referrer');
  });
  // Bloqueia requisições que alteram estado sem JSON: com cookie SameSite=Strict,
  // isso fecha a porta para CSRF via formulários HTML de outros sites.
  // Aceita a origem configurada e os domínios fornecidos pela Vercel
  // (deploy corrente e domínio de produção do projeto).
  const allowedOrigins = [
    env.WEB_ORIGIN,
    ...(process.env.VERCEL_URL ? ['https://' + process.env.VERCEL_URL] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_DOMAIN
      ? ['https://' + process.env.VERCEL_PROJECT_PRODUCTION_DOMAIN]
      : []),
  ];
  app.addHook('onRequest', async (request, reply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      if (
        request.headers['sec-fetch-site'] === 'cross-site' ||
        (request.headers.origin && !allowedOrigins.includes(request.headers.origin))
      )
        return reply.code(403).send({ error: 'forbidden', message: 'Origem não permitida.' });
      const type = request.headers['content-type'] ?? '';
      const hasBody = Number(request.headers['content-length'] ?? 0) > 0;
      if (hasBody && !type.startsWith('application/json')) {
        return reply
          .code(415)
          .send({ error: 'unsupported_media_type', message: 'Envie os dados em JSON.' });
      }
    }
  });
  app.addHook('preHandler', loadAdmin(db));

  await app.register(healthRoutes);
  await app.register(authRoutes(env));
  await app.register(adminEventRoutes);
  await app.register(adminAttendanceRoutes);
  await app.register(publicRoutes);
  if (env.WEB_DIST) await serveWeb(app, env.WEB_DIST);
  return app;
}
