import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { adminPasswordSchema, z } from '@eventpass/shared';
import { loadEnv } from '../env.js';
import { openDb } from '../db/index.js';
import { hashPassword } from '../auth/password.js';

/**
 * Cria (ou redefine a senha de) um administrador, no SQLite ou no Postgres.
 * Uso: npm run admin:create -w @eventpass/api
 * A senha é lida do terminal ou de ADMIN_PASSWORD; nunca é passada como argumento.
 */
const env = loadEnv();
const { db, applied } = await openDb(env);
if (applied.length) console.log(`Migrações aplicadas: ${applied.join(', ')}`);

const rl = createInterface({ input: stdin, output: stdout });
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .parse(process.env.ADMIN_EMAIL ?? (await rl.question('E-mail do administrador: ')));
const name = (process.env.ADMIN_NAME ?? (await rl.question('Nome: '))).trim() || email;
const passwordInput =
  process.env.ADMIN_PASSWORD ?? (await rl.question('Senha (mín. 12 caracteres): '));
rl.close();

const password = adminPasswordSchema.safeParse(passwordInput);
if (!password.success) {
  console.error(password.error.issues[0]?.message);
  process.exit(1);
}

const hash = await hashPassword(password.data);
await db.run(
  `INSERT INTO admins (email, name, password_hash, must_change_password) VALUES (?, ?, ?, 1)
   ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash, must_change_password = 1`,
  [email, name, hash],
);
// Redefinir a senha encerra as sessões existentes.
await db.run('DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = ?)', [
  email,
]);
console.log(`Administrador ${email} pronto (troca de senha obrigatória no primeiro acesso).`);
await db.close();
