import { openTestDatabase } from './db/test-database.js';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { type openDatabase } from './db/database.js';
import { hashPassword } from './auth/password.js';
export async function setupTestApp() {
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL });
  const db = await openTestDatabase();

  const app = await buildApp(env, db);
  app.addHook('onClose', async () => db.close());
  return { app, db, env };
}
export const TEST_ADMIN = {
  email: 'admin@exemplo.test',
  name: 'Admin Teste',
  password: 'senha-de-teste-123',
};
export async function seedAdmin(db: ReturnType<typeof openDatabase>) {
  await db
    .prepare('INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)')
    .run(TEST_ADMIN.email, TEST_ADMIN.name, await hashPassword(TEST_ADMIN.password));
}
import type { FastifyInstance } from 'fastify';
/** Faz login com o admin de teste e devolve o cabeçalho de cookie. */
export async function loginCookie(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
  });
  const c = res.cookies.find((c) => c.name === 'ep_session');
  if (!c) throw new Error(`login falhou: ${res.statusCode} ${res.body}`);
  return `ep_session=${c.value}`;
}
const hours = (h: number) => new Date(Date.now() + h * 3600000).toISOString();
export function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Workshop de React',
    description: 'Hands-on de componentes acessíveis.',
    location: 'Auditório 2',
    startsAt: hours(24),
    endsAt: hours(26),
    capacity: 2,
    checkinPoints: 15,
    ...overrides,
  };
}
/** Cria e publica um evento; devolve id e slug. */
export async function createPublishedEvent(app: FastifyInstance, cookie: string, overrides = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/admin/events',
    headers: { cookie },
    payload: eventPayload(overrides),
  });
  const { event } = res.json() as {
    event: {
      id: number;
      slug: string;
    };
  };
  await app.inject({
    method: 'POST',
    url: `/api/admin/events/${event.id}/status`,
    headers: { cookie },
    payload: { status: 'published' },
  });
  return event;
}
export async function register(app: FastifyInstance, slug: string, name: string, email: string) {
  return app.inject({
    method: 'POST',
    url: `/api/public/events/${slug}/registrations`,
    payload: { name, email },
  });
}
