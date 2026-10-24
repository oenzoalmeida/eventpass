#!/usr/bin/env node
/**
 * Teste de carga LOCAL do EventPass (padrões de 10, 30 e 50 usuários simultâneos).
 *
 * NÃO aponte para produção. Use contra o servidor local:
 *   DATABASE_DIALECT=sqlite npm run dev          # ou npm start
 *   node loadtest/loadtest.mjs http://127.0.0.1:3333 30
 *
 * Cenário por usuário: lista eventos → publica nada → inscreve-se (e-mail
 * único por usuário) → consulta o ingresso → consulta ranking. Ao final,
 * imprime latências, taxa de erro e throughput.
 */
const [base = 'http://127.0.0.1:3333', vusArg = '10'] = process.argv.slice(2);
const VUS = Number(vusArg);
if (![10, 30, 50].includes(VUS)) {
  console.error('VUs deve ser 10, 30 ou 50.');
  process.exit(1);
}
const DURATION_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (n) =>
  Math.random()
    .toString(36)
    .slice(2, 2 + n);

let ok = 0;
let fail = 0;
const latencies = [];

async function call(path, opts = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(base + path, opts);
    const body = await res.json().catch(() => null);
    const dt = performance.now() - t0;
    latencies.push(dt);
    if (res.status >= 500) throw new Error(String(res.status));
    if (res.status < 400 || res.status === 409 || res.status === 429)
      ok++; // 409/429 são respostas válidas de negócio
    else fail++;
    return { status: res.status, body };
  } catch {
    fail++;
    latencies.push(performance.now() - t0);
    return { status: 0, body: null };
  }
}

async function user(id, events, stopAt) {
  const email = `load-${rnd(8)}-${id}@exemplo.test`;
  while (Date.now() < stopAt) {
    for (const slug of events) {
      await call(`/api/public/events/${slug}`);
      const res = await call(`/api/public/events/${slug}/registrations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: `Load ${id}`, email }),
      });
      if (res.status === 201 && res.body?.ticketToken) {
        await call(`/api/public/tickets/${res.body.ticketToken}`);
      }
      await call('/api/public/leaderboard');
      if (Date.now() >= stopAt) break;
      await sleep(200 + Math.random() * 800);
    }
  }
}

const t0 = Date.now();
const stopAt = t0 + DURATION_MS;
const list = await (await fetch(`${base}/api/public/events`)).json();
const slugs = (list.events ?? []).map((e) => e.slug);
if (!slugs.length) {
  console.error('Nenhum evento publicado em /api/public/events — rode npm run db:seed antes.');
  process.exit(1);
}
console.log(
  `Carga: ${VUS} vus por ${DURATION_MS / 1000}s contra ${base} (${slugs.length} eventos)`,
);

await Promise.all(Array.from({ length: VUS }, (_, i) => user(i, slugs, stopAt)));

latencies.sort((a, b) => a - b);
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] ?? 0;
const secs = (Date.now() - t0) / 1000;
console.log(
  `\nRequisições: ${ok + fail} (${((ok + fail) / secs).toFixed(1)}/s) | ok=${ok} falhas=${fail}`,
);
console.log(
  `Latência ms: p50=${p(0.5).toFixed(0)} p90=${p(0.9).toFixed(0)} p99=${p(0.99).toFixed(0)}`,
);
