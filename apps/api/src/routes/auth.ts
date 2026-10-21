import type { FastifyInstance } from 'fastify';
import { loginRequestSchema, type AdminProfile } from '@eventpass/shared';
import { getDummyHash, verifyPassword } from '../auth/password.js';
import { SESSION_COOKIE, createSession, deleteSession } from '../auth/sessions.js';
import { requireAdmin } from '../auth/plugin.js';
import type { Env } from '../env.js';
export function authRoutes(env: Env) {
  return async (app: FastifyInstance) => {
    const cookieOpts = {
      path: '/',
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: env.COOKIE_SECURE,
    };
    app.post(
      '/api/auth/login',
      // Limita tentativas por IP para dificultar força bruta.
      { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
      async (request, reply) => {
        const parsed = loginRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'validation_error',
            message: 'Dados de login inválidos.',
            issues: parsed.error.flatten().fieldErrors,
          });
        }
        const { email, password } = parsed.data;
        const row = (await app.db
          .prepare(
            'SELECT id, email, name, password_hash FROM admins WHERE lower(email) = lower(?)',
          )
          .get(email)) as
          | (AdminProfile & {
              password_hash: string;
            })
          | undefined;
        // Sempre verifica um hash, mesmo sem conta, para não revelar e-mails cadastrados pelo tempo.
        const ok = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()));
        if (!row || !ok) {
          return reply
            .code(401)
            .send({ error: 'invalid_credentials', message: 'E-mail ou senha incorretos.' });
        }
        const { token, expiresAt } = await createSession(app.db, row.id, env.SESSION_TTL_HOURS);
        reply.setCookie(SESSION_COOKIE, token, { ...cookieOpts, expires: expiresAt });
        const admin: AdminProfile = { id: row.id, email: row.email, name: row.name };
        return { admin };
      },
    );
    app.post('/api/auth/logout', async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];
      if (token) await deleteSession(app.db, token);
      reply.clearCookie(SESSION_COOKIE, cookieOpts);
      return reply.code(204).send();
    });
    app.get('/api/auth/me', { preHandler: requireAdmin }, async (request) => ({
      admin: request.admin,
    }));
  };
}
