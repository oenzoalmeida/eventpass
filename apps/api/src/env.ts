import { z } from '@eventpass/shared';
const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();
const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3333),
  API_HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'Use PostgreSQL'),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 30)
    .default(12),
  /** Cookie com flag Secure. Padrão: ligado em produção. */
  COOKIE_SECURE: bool,
  /** Pasta do frontend compilado servida pela API. Vazio desativa. */
  WEB_DIST: z.string().default(''),
});
export type Env = Omit<z.infer<typeof envSchema>, 'COOKIE_SECURE'> & {
  COOKIE_SECURE: boolean;
};
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente inválidas: ${parsed.error.issues.map((i) => i.path.join('.') + ': ' + i.code).join(', ')}`,
    );
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.COOKIE_SECURE === false)
    throw new Error('Secure cookies required in production');
  return { ...env, COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production' };
}
