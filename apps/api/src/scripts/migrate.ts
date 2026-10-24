import { loadEnv } from '../env.js';
import { migrateDb } from '../db/index.js';

const env = loadEnv();
const { db, applied } = await migrateDb(env);
console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
await db.close();
process.exit(0);
