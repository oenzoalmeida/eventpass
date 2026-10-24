import { describe, expect, it } from 'vitest';

/**
 * O adaptador Netlify é exercido com SQLite em memória: prova a conversão
 * Request → Fastify → Response (cookies, headers, status) sem precisar da
 * infraestrutura. A conexão Postgres é validada em pg.test.ts.
 */
describe('adaptador Netlify Functions', () => {
  it('converte requisições e respostas corretamente', async () => {
    process.env.DATABASE_URL = ':memory:';
    process.env.DATABASE_DIALECT = 'sqlite';
    const { getNetlifyHandler } = await import('./netlify.js');
    const handler = await getNetlifyHandler();

    const health = await handler(new Request('http://localhost/api/health'));
    expect(health.status).toBe(200);
    expect((await health.json()).service).toBe('eventpass-api');

    const notFound = await handler(new Request('http://localhost/api/public/rota-inexistente'));
    expect(notFound.status).toBe(404);
  }, // buildApp compete com os testes de scrypt pela CPU na execução paralela.
  30_000);
});
