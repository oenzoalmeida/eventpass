#!/usr/bin/env node
/**
 * Sobe localmente a MESMA function que a Netlify publica (bundle gerado pelo
 * zip-it-and-ship-it) + o SPA compilado, para homologação/E2E sem depender da
 * nuvem. Uso:
 *
 *   npm run build
 *   node scripts/serve-function.mjs            # http://localhost:8877
 *
 * Variáveis de ambiente idênticas às da Netlify (DATABASE_* etc.).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 8877);
const DIST = process.env.DIST_DIR || 'apps/web/dist';
const HANDLER_PATH = resolve(process.env.HANDLER || '.deploy-netlify/built-x/functions/api.cjs');

const mod = await import(pathToFileURL(HANDLER_PATH).href);
const handler = typeof mod.default === 'function' ? mod.default : mod.default.default;

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = { ...req.headers };
      delete headers.host;
      const out = await handler(
        new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        }),
      );
      res.writeHead(out.status, Object.fromEntries(out.headers));
      if (out.status === 204 || out.status === 304) res.end();
      else res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }
    // SPA estático com fallback para index.html (mesmo comportamento do redirect da Netlify).
    let file = join(DIST, normalize(url.pathname).replace(/^([/\\])+/, '') || 'index.html');
    if (extname(file) === '') file = join(DIST, 'index.html');
    const body = await readFile(file).catch(() => readFile(join(DIST, 'index.html')));
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'proxy_error', message: String(err?.message || err) }));
  }
}).listen(PORT, () =>
  console.log(`homolog local em http://localhost:${PORT} (function: ${HANDLER_PATH})`),
);
