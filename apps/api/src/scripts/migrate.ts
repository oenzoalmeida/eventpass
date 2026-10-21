import { loadEnv } from '../env.js';
import { migrate, openDatabase } from '../db/database.js';

const env = loadEnv();
const db = openDatabase(env.DATABASE_URL);
const applied = migrate(db);
console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
db.close();
