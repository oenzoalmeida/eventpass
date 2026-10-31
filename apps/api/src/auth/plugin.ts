import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AdminProfile } from '@eventpass/shared';
import { SESSION_COOKIE, findSessionAdmin } from './sessions.js';
import type { DbClient } from '../db/client.js';

declare module 'fastify' {
  interface FastifyRequest {
    admin: AdminProfile | null;
  }
  interface FastifyInstance {
    db: DbClient;
  }
}

/** preHandler: carrega o admin da sessão (se houver) em request.admin. */
export function loadAdmin(db: DbClient) {
  return async (request: FastifyRequest) => {
    const token = request.cookies[SESSION_COOKIE];
    request.admin = token ? await findSessionAdmin(db, token) : null;
  };
}

// Com senha temporária, só estes caminhos respondem; todo o resto do painel exige a troca.
const PASSWORD_CHANGE_ALLOWED = new Set([
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/me',
]);

/** preHandler: bloqueia rotas administrativas sem sessão válida. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.admin) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Faça login para continuar.' });
  }
  const path = (request.raw.url ?? '').split('?')[0] ?? '';
  if (request.admin.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(path)) {
    return reply.code(403).send({
      error: 'password_change_required',
      message: 'Defina uma nova senha para continuar.',
    });
  }
}
