import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { migrate, openDatabase } from './db/database.js';
import { hashPassword } from './auth/password.js';

export async function setupTestApp() {
  const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: ':memory:' });
  const db = openDatabase(':memory:');
  migrate(db);
  const app = await buildApp(env, db);
  return { app, db, env };
}

export const TEST_ADMIN = { email: 'admin@exemplo.test', name: 'Admin Teste', password: 'senha-de-teste-123' };

export async function seedAdmin(db: ReturnType<typeof openDatabase>) {
  db.prepare('INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)').run(
    TEST_ADMIN.email,
    TEST_ADMIN.name,
    await hashPassword(TEST_ADMIN.password),
  );
}
