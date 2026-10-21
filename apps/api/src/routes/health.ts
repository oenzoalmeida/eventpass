import type { FastifyInstance } from 'fastify';
export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    await app.db.query('SELECT 1 FROM events LIMIT 1');
    return {
      status: 'ok',
      service: 'eventpass-api',
      version: '0.1.0',
      time: new Date().toISOString(),
    };
  });
}
