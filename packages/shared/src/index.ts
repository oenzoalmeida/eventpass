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

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export const eventStatusSchema = z.enum(['draft', 'published', 'closed']);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  closed: 'Encerrado',
};

const isoDate = z
  .string()
  .datetime({ offset: true, message: 'Data inválida.' })
  .transform((v) => new Date(v).toISOString());

const eventFields = {
  title: z.string().trim().min(3, 'O título precisa de pelo menos 3 caracteres.').max(120),
  description: z.string().trim().max(5000).default(''),
  location: z.string().trim().max(200).default(''),
  startsAt: isoDate,
  endsAt: isoDate,
  capacity: z.coerce
    .number({ invalid_type_error: 'Informe o número de vagas.' })
    .int('Use um número inteiro.')
    .min(1, 'O evento precisa de pelo menos 1 vaga.')
    .max(100_000),
  checkinPoints: z.coerce.number().int().min(0).max(1000).default(10),
};

export const eventInputSchema = z
  .object(eventFields)
  .refine((e) => e.endsAt >= e.startsAt, {
    path: ['endsAt'],
    message: 'O término precisa ser depois do início.',
  });
export type EventInput = z.input<typeof eventInputSchema>;

export const eventStatusInputSchema = z.object({ status: eventStatusSchema });

export const adminEventSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.number().int(),
  checkinPoints: z.number().int(),
  status: eventStatusSchema,
  registrations: z.number().int(),
  checkins: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminEvent = z.infer<typeof adminEventSchema>;

export const dashboardSummarySchema = z.object({
  events: z.object({ total: z.number(), draft: z.number(), published: z.number(), closed: z.number() }),
  registrations: z.number(),
  checkins: z.number(),
  points: z.number(),
  participants: z.number(),
  upcoming: z.array(adminEventSchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

// ---------------------------------------------------------------------------
// Páginas públicas e inscrições
// ---------------------------------------------------------------------------

export const publicEventSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  capacity: z.number().int(),
  spotsLeft: z.number().int(),
  checkinPoints: z.number().int(),
  isOpen: z.boolean(),
});
export type PublicEvent = z.infer<typeof publicEventSchema>;

export const registrationInputSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.').max(254),
});
export type RegistrationInput = z.infer<typeof registrationInputSchema>;

export const registrationCreatedSchema = z.object({ ticketToken: z.string() });

export const ticketSchema = z.object({
  event: publicEventSchema.pick({ slug: true, title: true, location: true, startsAt: true, endsAt: true }),
  participantName: z.string(),
  status: z.enum(['confirmed', 'cancelled']),
  checkedInAt: z.string().nullable(),
  qrSvg: z.string(),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const leaderboardSchema = z.array(
  z.object({ rank: z.number().int(), displayName: z.string(), points: z.number().int() }),
);
export type Leaderboard = z.infer<typeof leaderboardSchema>;

// ---------------------------------------------------------------------------
// Check-in, inscrições (visão admin) e relatórios
// ---------------------------------------------------------------------------

/** Token do ingresso: aceita o token puro ou a URL completa do ingresso. */
export const checkinRequestSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'Informe o código do ingresso.')
    .max(500)
    .transform((v) => v.split('/').filter(Boolean).pop() ?? v),
});

export const checkinResultSchema = z.object({
  alreadyCheckedIn: z.boolean(),
  participantName: z.string(),
  participantEmail: z.string(),
  pointsAwarded: z.number().int(),
  totalPoints: z.number().int(),
  checkedInAt: z.string(),
});
export type CheckinResult = z.infer<typeof checkinResultSchema>;

export const adminRegistrationSchema = z.object({
  id: z.number().int(),
  participantName: z.string(),
  participantEmail: z.string(),
  status: z.enum(['confirmed', 'cancelled']),
  createdAt: z.string(),
  checkedInAt: z.string().nullable(),
  points: z.number().int(),
});
export type AdminRegistration = z.infer<typeof adminRegistrationSchema>;

export const eventReportSchema = z.object({
  event: adminEventSchema,
  confirmed: z.number().int(),
  cancelled: z.number().int(),
  checkins: z.number().int(),
  attendanceRate: z.number(),
  occupancyRate: z.number(),
  pointsAwarded: z.number().int(),
  checkinsByHour: z.array(z.object({ hour: z.string(), count: z.number().int() })),
});
export type EventReport = z.infer<typeof eventReportSchema>;
