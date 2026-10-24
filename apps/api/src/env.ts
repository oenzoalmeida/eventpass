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
  /** Dialeto do banco: sqlite (arquivo local, versão de referência) ou postgres (Neon). */
  DATABASE_DIALECT: z.enum(['sqlite', 'postgres']).default('sqlite'),
  /** Caminho do SQLite ou string de conexão PostgreSQL (nunca comitada). */
  DATABASE_URL: z.string().min(1).default('./data/eventpass.db'),
  /** Migrações automáticas na inicialização. Padrão: false em produção, true no resto. */
  DB_AUTO_MIGRATE: bool,
  /** TLS para o Postgres. Padrão ligado (obrigatório no Neon); false só local. */
  DATABASE_SSL: bool,
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

export type Env = Omit<z.infer<typeof envSchema>, 'COOKIE_SECURE'> & { COOKIE_SECURE: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variáveis de ambiente inválidas: ${parsed.error.message}`);
  }
  const env = parsed.data;
  return {
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    DB_AUTO_MIGRATE: env.DB_AUTO_MIGRATE ?? env.NODE_ENV !== 'production',
  };
}
