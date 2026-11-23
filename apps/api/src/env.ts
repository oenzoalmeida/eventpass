import { z } from '@eventpass/shared';
import { decodeEmailKey } from './lib/email/crypto.js';

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
  EMAIL_ENABLED: bool,
  TICKET_RECOVERY_ENABLED: bool,
  EMAIL_ENCRYPTION_KEY: z.string().optional(),
  EMAIL_PUBLIC_BASE_URL: z.string().url().optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export type Env = Omit<z.infer<typeof envSchema>, 'COOKIE_SECURE'> & { COOKIE_SECURE: boolean };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Validation details may contain the actual secret supplied as an invalid value.
    throw new Error('Variáveis de ambiente inválidas. Confira os nomes e formatos configurados.');
  }
  const env = parsed.data;
  if (env.EMAIL_ENABLED) {
    if (!env.EMAIL_ENCRYPTION_KEY || !env.EMAIL_PUBLIC_BASE_URL) throw new Error('Missing email configuration');
    decodeEmailKey(env.EMAIL_ENCRYPTION_KEY);
    if (env.NODE_ENV === 'production') {
      const siteUrl = new URL(env.EMAIL_PUBLIC_BASE_URL);
      if (siteUrl.protocol !== 'https:') throw new Error('Email public base URL must use HTTPS');
      if (siteUrl.origin !== new URL(env.WEB_ORIGIN).origin) {
        throw new Error('Email public base URL must match the configured frontend origin');
      }
      if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
        throw new Error('Real email delivery requires Resend credentials and a verified sender');
      }
    }
  }
  return {
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    DB_AUTO_MIGRATE: env.DB_AUTO_MIGRATE ?? env.NODE_ENV !== 'production',
  };
}
