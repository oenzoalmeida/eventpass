import { loadEnv } from '../env.js';
import { migrate, openDatabase } from '../db/database.js';
const env = loadEnv();
const db = openDatabase(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL);
const applied = await migrate(db);
console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
await db.close();
