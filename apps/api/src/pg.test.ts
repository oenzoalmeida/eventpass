import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { PgClient, migratePostgres } from './db/pg.js';
import { hashPassword } from './auth/password.js';
import { loginCookie, eventPayload, TEST_ADMIN } from './test-utils.js';

/**
 * Testes de integração PostgreSQL (dialeto usado no Neon/Netlify).
 * Só rodam quando PG_TEST_DATABASE_URL está definido — aponte para um banco
 * DESCARTÁVEL (nunca para o homolog de verdade):
 *
 *   docker run -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16
 *   PG_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres DATABASE_SSL=false npm run test:pg -w @eventpass/api
 *
 * O banco é truncado entre testes: NUNCA use com dados que importem.
 */
const url = process.env.PG_TEST_DATABASE_URL;
const describePg = url ? describe : describe.skip;

describePg('PostgreSQL (dialect do Neon)', () => {
  let db: PgClient;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = new PgClient(url!, { ssl: process.env.PG_TEST_SSL !== 'false', prepare: false });
    // Banco descartável por contrato: recria o schema inteiro a cada teste,
    // deixando o estado determinístico mesmo após execuções interrompidas.
    await db.run('DROP SCHEMA public CASCADE');
    await db.run('CREATE SCHEMA public');
    await migratePostgres(db);
    await db.run(`INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)`, [
      TEST_ADMIN.email,
      TEST_ADMIN.name,
      await hashPassword(TEST_ADMIN.password),
    ]);
    const env = loadEnv({ ...process.env, NODE_ENV: 'test' });
    app = await buildApp(env, db);
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it('login cria sessão persistente entre instâncias do app', async () => {
    const cookie = await loginCookie(app);
    expect(cookie).toContain('ep_session=');
    // Sessão vale para outra "invocação": outra instância com o mesmo banco.
    const env = loadEnv({ ...process.env, NODE_ENV: 'test' });
    const app2 = await buildApp(env, db);
    const me = await app2.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().admin.email).toBe(TEST_ADMIN.email);
    await app2.close();
  });

  it('inscrições simultâneas respeitam a capacidade', async () => {
    const cookie = await loginCookie(app);
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/events',
      headers: { cookie },
      payload: eventPayload({ capacity: 2 }),
    });
    const { id } = create.json().event as { id: number };
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${id}/status`,
      headers: { cookie },
      payload: { status: 'published' },
    });
    const slug = create.json().event.slug as string;

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: `/api/public/events/${slug}/registrations`,
          payload: { name: `Pessoa ${i}`, email: `pessoa${i}@exemplo.test` },
        }),
      ),
    );
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(2);
    expect(codes.filter((c) => c === 409)).toHaveLength(4);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/events/${id}`,
      headers: { cookie },
    });
    expect(detail.json().event.registrations).toBe(2);
  });

  it('adaptador Netlify: migrações rodam antes do app e a sessão persiste entre invocações', async () => {
    const prev = { ...process.env };
    process.env.DATABASE_DIALECT = 'postgres';
    process.env.DATABASE_URL = url!;
    process.env.DATABASE_SSL = process.env.PG_TEST_SSL ?? 'false';
    try {
      // O import ocorre DEPOIS de definir o env: openDb aplica as migrações
      // pendentes antes de construir o app (mesmo caminho da Netlify Function).
      const { getNetlifyHandler, closeNetlify } = await import('./netlify.js');
      const handler = await getNetlifyHandler();

      const health = await handler(new Request('http://x/api/health'));
      expect(health.status).toBe(200);

      // Login numa "invocação"; o cookie vale na seguinte (sessão no banco).
      const login = await handler(
        new Request('http://x/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: TEST_ADMIN.email, password: TEST_ADMIN.password }),
        }),
      );
      expect(login.status).toBe(200);
      const cookie = login.headers.get('set-cookie')!.split(';')[0]!;

      const me = await handler(new Request('http://x/api/auth/me', { headers: { cookie } }));
      expect(me.status).toBe(200);
      expect((await me.json()).admin.email).toBe(TEST_ADMIN.email);

      await closeNetlify();
    } finally {
      process.env = prev;
    }
  });

  it('produção não altera o schema na inicialização: falha se falta migração', async () => {
    const { openDb } = await import('./db/index.js');
    const prodEnv = loadEnv({
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_DIALECT: 'postgres',
      DATABASE_URL: url!,
      DATABASE_SSL: process.env.PG_TEST_SSL ?? 'false',
      // DB_AUTO_MIGRATE fica false por padrão em produção.
    });
    // Banco na versão do código: abre sem migrar nada.
    const ok = await openDb(prodEnv);
    await ok.db.close();

    // Banco desatualizado: recusa com instrução, sem tocar no schema.
    await db.run('DELETE FROM schema_migrations');
    await expect(openDb(prodEnv)).rejects.toThrow(/Migrações pendentes|Migração/i);
    // Restaura o registro (sem reaplicar DDL) para os próximos testes.
    await db.run(`INSERT INTO schema_migrations (name) VALUES ('001_initial.sql')`);
  });

  it('check-in duplicado não gera pontos adicionais', async () => {
    const cookie = await loginCookie(app);
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/events',
      headers: { cookie },
      payload: eventPayload({ capacity: 10, checkinPoints: 20 }),
    });
    const { id, slug } = create.json().event as { id: number; slug: string };
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${id}/status`,
      headers: { cookie },
      payload: { status: 'published' },
    });
    const reg = await app.inject({
      method: 'POST',
      url: `/api/public/events/${slug}/registrations`,
      payload: { name: 'Ana Souza', email: 'ana@exemplo.test' },
    });
    const token = reg.json().ticketToken as string;
    // Falha com a causa real se a inscrição não sair 201 (flake em CI era
    // mascarado por 'expected undefined to be false').
    expect(reg.statusCode, JSON.stringify(reg.json())).toBe(201);

    const scan = async () =>
      app.inject({
        method: 'POST',
        url: `/api/admin/events/${id}/checkins`,
        headers: { cookie },
        payload: { token },
      });

    const first = (await (await scan()).json()) as {
      alreadyCheckedIn: boolean;
      pointsAwarded: number;
    };
    // Duas leituras simultâneas do mesmo QR: só a primeira pontua.
    const [a, b] = await Promise.all([scan(), scan()]);
    const ja = [a.json(), b.json()] as Array<{ alreadyCheckedIn: boolean; pointsAwarded: number }>;

    expect(first.alreadyCheckedIn).toBe(false);
    expect(first.pointsAwarded).toBe(20);
    expect(ja.every((r) => r.alreadyCheckedIn && r.pointsAwarded === 0)).toBe(true);
    // Pontos lançados uma única vez.
    const points = await db.get<{ n: string }>('SELECT SUM(points) AS n FROM point_entries');
    expect(Number(points!.n)).toBe(20);
    const board = await app.inject({ method: 'GET', url: '/api/public/leaderboard' });
    expect(board.json().leaderboard[0]).toMatchObject({ displayName: 'Ana S.', points: 20 });
  });

  it('dashboard, relatório e CSV funcionam com o dialeto', async () => {
    const cookie = await loginCookie(app);
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/events',
      headers: { cookie },
      payload: eventPayload({ capacity: 5, checkinPoints: 10 }),
    });
    const { id, slug } = create.json().event as { id: number; slug: string };
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${id}/status`,
      headers: { cookie },
      payload: { status: 'published' },
    });
    const reg = await app.inject({
      method: 'POST',
      url: `/api/public/events/${slug}/registrations`,
      payload: { name: 'Bruno Lima', email: 'bruno@exemplo.test' },
    });
    const token = reg.json().ticketToken as string;
    await app.inject({
      method: 'POST',
      url: `/api/admin/events/${id}/checkins`,
      headers: { cookie },
      payload: { token },
    });

    const dash = await app.inject({
      method: 'GET',
      url: '/api/admin/dashboard',
      headers: { cookie },
    });
    expect(dash.statusCode).toBe(200);
    expect(dash.json().events.published).toBe(1);
    expect(dash.json().checkins).toBe(1);

    const report = await app.inject({
      method: 'GET',
      url: `/api/admin/events/${id}/report`,
      headers: { cookie },
    });
    expect(report.json().report.pointsAwarded).toBe(10);
    expect(report.json().report.attendanceRate).toBe(100);

    const csv = await app.inject({
      method: 'GET',
      url: `/api/admin/events/${id}/registrations.csv`,
      headers: { cookie },
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('bruno@exemplo.test');
  });
});
