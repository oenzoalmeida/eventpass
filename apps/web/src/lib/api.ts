import {
  adminProfileSchema,
  apiErrorSchema,
  healthResponseSchema,
  type AdminProfile,
  type HealthResponse,
  type LoginRequest,
  z,
} from '@eventpass/shared';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function request<T>(path: string, schema: z.ZodType<T> | null, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = apiErrorSchema.safeParse(await res.json().catch(() => null));
    throw new ApiRequestError(
      res.status,
      body.success ? body.data.message : `Erro inesperado (${res.status}).`,
      body.success ? body.data.issues : undefined,
    );
  }
  return schema ? schema.parse(await res.json()) : (undefined as T);
}

const adminEnvelope = z.object({ admin: adminProfileSchema });

export const api = {
  health: (signal?: AbortSignal): Promise<HealthResponse> =>
    request('/api/health', healthResponseSchema, { signal }),
  me: async (): Promise<AdminProfile> => (await request('/api/auth/me', adminEnvelope)).admin,
  login: async (data: LoginRequest): Promise<AdminProfile> =>
    (await request('/api/auth/login', adminEnvelope, { method: 'POST', body: JSON.stringify(data) })).admin,
  logout: (): Promise<void> => request('/api/auth/logout', null, { method: 'POST' }),
};
