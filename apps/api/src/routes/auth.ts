import type { FastifyInstance } from 'fastify';
import { changePasswordRequestSchema, loginRequestSchema, type AdminProfile } from '@eventpass/shared';
import { getDummyHash, hashPassword, verifyPassword } from '../auth/password.js';
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
        const row = await app.db.get<
          Omit<AdminProfile, 'mustChangePassword'> & {
            password_hash: string;
            must_change_password: number | boolean;
          }
        >('SELECT id, email, name, password_hash, must_change_password FROM admins WHERE email = ?', [
          email,
        ]);

        // Sempre verifica um hash, mesmo sem conta, para não revelar e-mails cadastrados pelo tempo.
        const ok = await verifyPassword(password, row?.password_hash ?? (await getDummyHash()));
        if (!row || !ok) {
          return reply
            .code(401)
            .send({ error: 'invalid_credentials', message: 'E-mail ou senha incorretos.' });
        }

        const { token, expiresAt } = await createSession(app.db, row.id, env.SESSION_TTL_HOURS);
        reply.setCookie(SESSION_COOKIE, token, { ...cookieOpts, expires: expiresAt });
        const admin: AdminProfile = {
          id: row.id,
          email: row.email,
          name: row.name,
          mustChangePassword: row.must_change_password === 1 || row.must_change_password === true,
        };
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

    // Troca a senha (temporária ou não), encerra as outras sessões e abre uma nova.
    app.post('/api/auth/change-password', { preHandler: requireAdmin }, async (request, reply) => {
      const parsed = changePasswordRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'validation_error',
          message: 'Dados inválidos para troca de senha.',
          issues: parsed.error.flatten().fieldErrors,
        });
      }
      const admin = request.admin!;
      const row = await app.db.get<{ password_hash: string }>(
        'SELECT password_hash FROM admins WHERE id = ?',
        [admin.id],
      );
      const ok = row && (await verifyPassword(parsed.data.currentPassword, row.password_hash));
      if (!ok) {
        return reply
          .code(401)
          .send({ error: 'invalid_credentials', message: 'Senha atual incorreta.' });
      }
      const hash = await hashPassword(parsed.data.newPassword);
      await app.db.run(
        'UPDATE admins SET password_hash = ?, must_change_password = 0 WHERE id = ?',
        [hash, admin.id],
      );
      // Revoga todas as sessões (inclusive a atual) e emite uma nova com a senha já trocada.
      await app.db.run('DELETE FROM sessions WHERE admin_id = ?', [admin.id]);
      const { token, expiresAt } = await createSession(app.db, admin.id, env.SESSION_TTL_HOURS);
      reply.setCookie(SESSION_COOKIE, token, { ...cookieOpts, expires: expiresAt });
      return { admin: { ...admin, mustChangePassword: false } };
    });
  };
}
