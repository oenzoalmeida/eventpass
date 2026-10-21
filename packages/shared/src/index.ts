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

/** Login do administrador. */
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
  password: z.string().min(1, 'Informe a senha.').max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const adminProfileSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  name: z.string(),
});
export type AdminProfile = z.infer<typeof adminProfileSchema>;

/** Regras mínimas de senha para contas administrativas. */
export const adminPasswordSchema = z
  .string()
  .min(12, 'A senha precisa ter pelo menos 12 caracteres.')
  .max(256);

/** Formato padrão de erro da API. */
export const apiErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  issues: z.record(z.array(z.string())).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
