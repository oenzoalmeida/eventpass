import { existsSync } from 'node:fs';
import { loadEnv } from '../env.js';
import { openDatabase } from '../db/database.js';

/**
 * Cria um backup consistente do banco com VACUUM INTO: gera um arquivo novo,
 * compactado, a partir de um snapshot atômico — seguro mesmo com a API no ar
 * (modo WAL). Depois valida o arquivo com PRAGMA integrity_check.
 */
const env = loadEnv();
if (env.DATABASE_URL === ':memory:') {
  console.error('DATABASE_URL=:memory: não tem arquivo para backup.');
  process.exit(1);
}
if (!existsSync(env.DATABASE_URL)) {
  console.error(`Banco não encontrado: ${env.DATABASE_URL}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = `${env.DATABASE_URL}.backup-${stamp}.db`;

const db = openDatabase(env.DATABASE_URL);
db.prepare('VACUUM INTO ?').run(target);
const check = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
db.close();

if (check.integrity_check !== 'ok') {
  console.error(`Backup criado, mas integrity_check retornou: ${check.integrity_check}`);
  process.exit(1);
}
console.log(`Backup criado e verificado: ${target}`);
