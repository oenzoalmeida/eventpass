import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { adminPasswordSchema, z } from '@eventpass/shared';
import { loadEnv } from '../env.js';
import { migrate, openDatabase } from '../db/database.js';
import { hashPassword } from '../auth/password.js';

/**
 * Cria (ou redefine a senha de) um administrador.
 * Uso: npm run admin:create -w @eventpass/api
 * A senha é lida do terminal ou de ADMIN_PASSWORD; nunca é passada como argumento.
 */
const env = loadEnv();
const db = openDatabase(env.DATABASE_URL);
migrate(db);

const rl = createInterface({ input: stdin, output: stdout });
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .parse(process.env.ADMIN_EMAIL ?? (await rl.question('E-mail do administrador: ')));
const name = (process.env.ADMIN_NAME ?? (await rl.question('Nome: '))).trim() || email;
const passwordInput = process.env.ADMIN_PASSWORD ?? (await rl.question('Senha (mín. 12 caracteres): '));
rl.close();

const password = adminPasswordSchema.safeParse(passwordInput);
if (!password.success) {
  console.error(password.error.issues[0]?.message);
  process.exit(1);
}

const hash = await hashPassword(password.data);
db.prepare(
  `INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)
   ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash`,
).run(email, name, hash);
// Redefinir a senha encerra as sessões existentes.
db.prepare('DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = ?)').run(email);
console.log(`Administrador ${email} pronto.`);
db.close();
