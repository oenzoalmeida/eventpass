import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { Env } from './env.js';
import type { Database } from './db/database.js';
import { purgeExpiredSessions } from './auth/sessions.js';
import { loadAdmin } from './auth/plugin.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { adminEventRoutes } from './routes/admin-events.js';

export async function buildApp(env: Env, db: Database) {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
    trustProxy: env.NODE_ENV === 'production',
  });

  app.decorate('db', db);
  app.decorateRequest('admin', null);

  await app.register(helmet);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });

  // Bloqueia requisições que alteram estado sem JSON: com cookie SameSite=Strict,
  // isso fecha a porta para CSRF via formulários HTML de outros sites.
  app.addHook('onRequest', async (request, reply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
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

  const purge = setInterval(() => purgeExpiredSessions(db), 3600_000);
  purge.unref();
  app.addHook('onClose', async () => clearInterval(purge));

  await app.register(healthRoutes);
  await app.register(authRoutes(env));
  await app.register(adminEventRoutes);

  return app;
}
