import { loadEnv } from '../env.js';
import { openDb } from '../db/index.js';

const env = loadEnv();
const { applied } = await openDb(env);
console.log(applied.length ? `Aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
process.exit(0);
