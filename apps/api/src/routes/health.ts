import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@eventpass/shared';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'eventpass-api',
    version: '0.1.0',
    time: new Date().toISOString(),
  }));
}
