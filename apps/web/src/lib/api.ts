import {
  adminEventSchema,
  adminProfileSchema,
  adminRegistrationSchema,
  apiErrorSchema,
  checkinResultSchema,
  dashboardSummarySchema,
  eventReportSchema,
  healthResponseSchema,
  leaderboardSchema,
  publicEventSchema,
  registrationCreatedSchema,
  ticketSchema,
  type AdminProfile,
  type EventInput,
  type EventStatus,
  type LoginRequest,
  type RegistrationInput,
  z,
} from '@eventpass/shared';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, schema: z.ZodType<T> | null, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: init?.body ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError(0, 'network_error', 'Sem conexão com o servidor. Tente novamente.');
  }
  if (!res.ok) {
    const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
    throw new ApiRequestError(
      res.status,
      body.success ? body.data.error : 'unknown',
      body.success ? body.data.message : `Erro inesperado (${res.status}).`,
      body.success ? body.data.issues : undefined,
    );
  }
  return schema ? schema.parse(await res.json()) : (undefined as T);
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

const adminEnvelope = z.object({ admin: adminProfileSchema });
const eventEnvelope = z.object({ event: adminEventSchema });

export const api = {
  health: (signal?: AbortSignal) => request('/api/health', healthResponseSchema, { signal }),

  // Autenticação
  me: async (): Promise<AdminProfile> => (await request('/api/auth/me', adminEnvelope)).admin,
  login: async (data: LoginRequest) => (await request('/api/auth/login', adminEnvelope, json('POST', data))).admin,
  logout: () => request('/api/auth/logout', null, json('POST')),

  // Admin: eventos
  dashboard: () => request('/api/admin/dashboard', dashboardSummarySchema),
  events: async () => (await request('/api/admin/events', z.object({ events: z.array(adminEventSchema) }))).events,
  event: async (id: number) => (await request(`/api/admin/events/${id}`, eventEnvelope)).event,
  createEvent: async (data: EventInput) => (await request('/api/admin/events', eventEnvelope, json('POST', data))).event,
  updateEvent: async (id: number, data: EventInput) =>
    (await request(`/api/admin/events/${id}`, eventEnvelope, json('PUT', data))).event,
  setEventStatus: async (id: number, status: EventStatus) =>
    (await request(`/api/admin/events/${id}/status`, eventEnvelope, json('POST', { status }))).event,
  deleteEvent: (id: number) => request(`/api/admin/events/${id}`, null, json('DELETE')),

  // Admin: presença e relatórios
  registrations: async (eventId: number) =>
    (
      await request(
        `/api/admin/events/${eventId}/registrations`,
        z.object({ registrations: z.array(adminRegistrationSchema) }),
      )
    ).registrations,
  cancelRegistration: (eventId: number, registrationId: number) =>
    request(`/api/admin/events/${eventId}/registrations/${registrationId}/cancel`, null, json('POST')),
  checkin: (eventId: number, token: string) =>
    request(`/api/admin/events/${eventId}/checkins`, checkinResultSchema, json('POST', { token })),
  report: async (eventId: number) =>
    (await request(`/api/admin/events/${eventId}/report`, z.object({ report: eventReportSchema }))).report,
  registrationsCsvUrl: (eventId: number) => `/api/admin/events/${eventId}/registrations.csv`,

  // Público
  publicEvents: async () =>
    (await request('/api/public/events', z.object({ events: z.array(publicEventSchema) }))).events,
  publicEvent: async (slug: string) =>
    (await request(`/api/public/events/${encodeURIComponent(slug)}`, z.object({ event: publicEventSchema }))).event,
  register: async (slug: string, data: RegistrationInput) =>
    (
      await request(
        `/api/public/events/${encodeURIComponent(slug)}/registrations`,
        registrationCreatedSchema,
        json('POST', data),
      )
    ).ticketToken,
  ticket: async (token: string) =>
    (await request(`/api/public/tickets/${encodeURIComponent(token)}`, z.object({ ticket: ticketSchema }))).ticket,
  leaderboard: async () =>
    (await request('/api/public/leaderboard', z.object({ leaderboard: leaderboardSchema }))).leaderboard,
};
