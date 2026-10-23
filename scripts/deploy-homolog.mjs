#!/usr/bin/env node
/**
 * Monta o pacote de deploy do Netlify (site + function) e publica com o CLI.
 *
 * O Netlify CLI recusa deploys na raiz de monorepo npm (detecção de múltiplos
 * projetos), então este script monta um diretório temporário autocontido:
 *
 *   dist/           frontend compilado (apps/web/dist)
 *   functions/api   handler que importa ../src (fonte da API)
 *   src/            código-fonte da API (empacotado pelo esbuild do Netlify)
 *   netlify.toml    redirects /api/* e SPA
 *
 * Uso (precisa de `netlify login` feito):
 *   npm run build && node scripts/deploy-homolog.mjs
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SITE_ID = process.env.NETLIFY_SITE_ID || 'e7bc4548-6a98-4d4a-b9ab-ca4929f719d1';
const OUT = '.deploy-netlify';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT + '/functions', { recursive: true });
cpSync('apps/web/dist', OUT + '/dist', { recursive: true });
cpSync('apps/api/src', OUT + '/src', { recursive: true });
writeFileSync(
  OUT + '/functions/api.ts',
  readFileSync('apps/api/netlify/functions/api.ts', 'utf8').replace(
    '../../src/netlify.js',
    '../src/netlify.js',
  ),
);
writeFileSync(
  OUT + '/package.json',
  JSON.stringify({ name: 'eventpass-deploy', private: true }, null, 2) + '\n',
);
writeFileSync(
  OUT + '/netlify.toml',
  `[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`,
);

if (process.argv.includes('--skip-publish')) {
  console.log(`Pacote montado em ${OUT}/ (publicação pulada com --skip-publish).`);
} else {
  console.log('Publicando em https://incomparable-panda-7984de.netlify.app (site ' + SITE_ID + ')');
  execSync(`netlify deploy --prod --site ${SITE_ID} --dir dist --functions functions --message "homolog"`, {
    cwd: OUT,
    stdio: 'inherit',
  });
  rmSync(OUT, { recursive: true, force: true });
}
