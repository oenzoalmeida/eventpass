import { z } from 'zod';

/** Resposta do endpoint de saúde da API, compartilhada entre frontend e backend. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('eventpass-api'),
  version: z.string(),
  time: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export { z };
