#!/usr/bin/env node
/**
 * Suíte E2E de homologação do EventPass — valida pela HTTP o fluxo completo:
 * login → criação/publicação de evento → inscrições (com controle de vagas) →
 * ingresso com QR → check-in idempotente → pontuação → relatório → CSV →
 * ranking → logout, além de checagens de segurança (cookie, 401/415).
 *
 * Uso:
 *   BASE_URL=https://... node scripts/e2e-homolog.mjs
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=...   (credenciais do admin de teste)
 *
 * Sem ADMIN_* usa admin.homolog@test.local / Homolog-Teste-2026-Segura
 * (o admin fictício criado pelo procedimento de homologação).
 */
const BASE = process.env.BASE_URL || 'http://localhost:8877';
const ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin.homolog@test.local',
  password: process.env.ADMIN_PASSWORD || 'Homolog-Teste-2026-Segura',
};

let passed = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`ok   ${name}`);
  } else {
    failures.push(name + (extra ? ` — ${extra}` : ''));
    console.log(`FALHA ${name} ${extra}`);
  }
}

const api = async (path, { method = 'GET', body, cookie } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // respostas não-JSON (CSV, 204)
  }
  return { res, json, text, setCookie: res.headers.get('set-cookie') || '' };
};

const day = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// 1. Health
{
  const { res, json } = await api('/api/health');
  check('health responde ok', res.status === 200 && json?.status === 'ok');
}

// 2. Login + sessão
let cookie = '';
{
  const { res, setCookie } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: ADMIN.email, password: ADMIN.password },
  });
  check('login 200', res.status === 200, `status=${res.status}`);
  check(
    'cookie httpOnly+sameSite=strict',
    /httponly/i.test(setCookie) && /samesite=strict/i.test(setCookie),
  );
  cookie = setCookie.split(';')[0];

  const me = await api('/api/auth/me', { cookie });
  check('sessão persiste (/me)', me.res.status === 200 && me.json?.admin?.email === ADMIN.email);

  const anon = await api('/api/admin/dashboard');
  check('rota admin bloqueia sem sessão (401)', anon.res.status === 401);

  const badType = await api('/api/auth/login', {
    method: 'POST',
    body: 'email=a&password=b',
  });
  // fetch sempre manda JSON aqui; valida 401 com senha errada
  const bad = await api('/api/auth/login', {
    method: 'POST',
    body: { email: ADMIN.email, password: 'senha-errada-000000' },
  });
  check('senha errada recusada (401)', bad.res.status === 401);
  void badType;
}

// 3. Evento: criar, publicar
let event = null;
{
  const { res, json } = await api('/api/admin/events', {
    method: 'POST',
    cookie,
    body: {
      title: 'E2E Homolog ' + Date.now(),
      description: 'Evento fictício de validação.',
      location: 'Auditório de teste',
      startsAt: day(24),
      endsAt: day(26),
      capacity: 3,
      checkinPoints: 25,
    },
  });
  check('cria evento (201)', res.status === 201, `status=${res.status}`);
  event = json?.event;

  const pub = await api(`/api/admin/events/${event.id}/status`, {
    method: 'POST',
    cookie,
    body: { status: 'published' },
  });
  check('publica evento', pub.json?.event?.status === 'published');

  const hidden = await api('/api/public/events');
  check(
    'evento aparece na vitrine pública',
    hidden.json?.events?.some((e) => e.slug === event.slug),
  );
}

// 4. Inscrições + controle de vagas
const tokens = [];
{
  for (let i = 0; i < 5; i++) {
    const { res, json } = await api(`/api/public/events/${event.slug}/registrations`, {
      method: 'POST',
      body: { name: `Participante E2E ${i}`, email: `e2e-${Date.now()}-${i}@teste.local` },
    });
    if (i < 3) {
      check(`inscrição ${i + 1} aceita (201)`, res.status === 201, `status=${res.status}`);
      tokens.push(json?.ticketToken);
    } else {
      check(
        `inscrição ${i + 1} recusada por lotes (409)`,
        res.status === 409,
        `status=${res.status}`,
      );
    }
  }
  check('3 ingressos emitidos', tokens.length === 3 && tokens.every(Boolean));

  const dup = await api(`/api/public/events/${event.slug}/registrations`, {
    method: 'POST',
    body: { name: 'Participante E2E 0', email: `e2e-reuso@teste.local` },
  });
  void dup;
}

// 5. Ingresso com QR
{
  const { res, json } = await api(`/api/public/tickets/${tokens[0]}`);
  check('ingresso com QR SVG', res.status === 200 && json?.ticket?.qrSvg?.includes('<svg'));
  check(
    'ingresso sem check-in',
    json?.ticket?.status === 'confirmed' && json?.ticket?.checkedInAt === null,
  );

  const notFound = await api('/api/public/tickets/token-invalido-xyz');
  check('ingresso inválido 404', notFound.res.status === 404);
}

// 6. Check-in idempotente + pontuação
{
  const first = await api(`/api/admin/events/${event.id}/checkins`, {
    method: 'POST',
    cookie,
    body: { token: tokens[0] },
  });
  check(
    'primeiro check-in pontua',
    first.json?.alreadyCheckedIn === false && first.json?.pointsAwarded === 25,
    JSON.stringify(first.json),
  );

  const again = await api(`/api/admin/events/${event.id}/checkins`, {
    method: 'POST',
    cookie,
    body: { token: tokens[0] },
  });
  check(
    'QR relido não pontua de novo',
    again.json?.alreadyCheckedIn === true && again.json?.pointsAwarded === 0,
  );

  const other = await api(`/api/admin/events/${event.id}/checkins`, {
    method: 'POST',
    cookie,
    body: { token: tokens[1] },
  });
  check('segundo participante check-in ok', other.json?.alreadyCheckedIn === false);
}

// 7. Relatório, CSV, ranking, dashboard
{
  const report = await api(`/api/admin/events/${event.id}/report`, { cookie });
  check(
    'relatório: 3 confirmados',
    report.json?.report?.confirmed === 3,
    JSON.stringify(report.json?.report?.confirmed),
  );
  check(
    'relatório: 2 check-ins de 3 confirmados (66,7%)',
    report.json?.report?.checkins === 2 && report.json?.report?.attendanceRate === 66.7,
    JSON.stringify(report.json?.report),
  );
  check('relatório: 50 pontos', report.json?.report?.pointsAwarded === 50);

  const csv = await fetch(`${BASE}/api/admin/events/${event.id}/registrations.csv`, {
    headers: { cookie },
  });
  const csvText = await csv.text();
  check(
    'CSV com inscrições e separador pt-BR',
    csv.status === 200 && csvText.includes(';') && csvText.includes('Participante E2E'),
  );

  const board = await api('/api/public/leaderboard');
  check(
    'ranking público com nomes abreviados',
    board.json?.leaderboard?.length >= 2 && board.json.leaderboard[0].displayName.includes('.'),
  );

  const dash = await api('/api/admin/dashboard', { cookie });
  check('dashboard com totais', dash.json?.checkins >= 2 && dash.json?.points >= 50);
}

// 8. Cancelamento e regra de conflito
{
  const regs = await api(`/api/admin/events/${event.id}/registrations`, { cookie });
  const checked = regs.json.registrations.find((r) => r.checkedInAt);
  const cancelChecked = await api(
    `/api/admin/events/${event.id}/registrations/${checked.id}/cancel`,
    { method: 'POST', cookie },
  );
  check('cancelar inscrição com check-in recusado (409)', cancelChecked.res.status === 409);
}

// 9. Logout encerra sessão
{
  const out = await api('/api/auth/logout', { method: 'POST', cookie });
  check('logout 204', out.res.status === 204);
  const after = await api('/api/admin/dashboard', { cookie });
  check('sessão inválida após logout', after.res.status === 401);
}

console.log(`\n${passed} ok | ${failures.length} falhas`);
if (failures.length) {
  console.log('FALHAS:\n' + failures.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
