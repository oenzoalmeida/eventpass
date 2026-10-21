import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AdminProfile } from '@eventpass/shared';
import { SESSION_COOKIE, findSessionAdmin } from './sessions.js';
import type { Database } from '../db/database.js';
declare module 'fastify' {
  interface FastifyRequest {
    admin: AdminProfile | null;
  }
  interface FastifyInstance {
    db: Database;
  }
}
/** preHandler: carrega o admin da sessão (se houver) em request.admin. */
export function loadAdmin(db: Database) {
  return async (request: FastifyRequest) => {
    const token = request.cookies[SESSION_COOKIE];
    request.admin = token ? await findSessionAdmin(db, token) : null;
  };
}
/** preHandler: bloqueia rotas administrativas sem sessão válida. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.admin) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Faça login para continuar.' });
  }
}
