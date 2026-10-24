import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { openDatabase, migrate } from './db/database.js';
import { SqliteClient } from './db/sqlite-client.js';
import type { DbClient } from './db/client.js';
import { hashPassword } from './auth/password.js';

export async function setupTestApp() {
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: ':memory:' });
  const db = new SqliteClient(openDatabase(':memory:'));
  migrate(db.raw());
  const app = await buildApp(env, db);
  return { app, db, env };
}

export const TEST_ADMIN = {
  email: 'admin@exemplo.test',
  name: 'Admin Teste',
  password: 'senha-de-teste-123',
};

export async function seedAdmin(db: DbClient) {
  await db.run('INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)', [
    TEST_ADMIN.email,
    TEST_ADMIN.name,
    await hashPassword(TEST_ADMIN.password),
  ]);
}

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

const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

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
  const { event } = res.json() as { event: { id: number; slug: string } };
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
