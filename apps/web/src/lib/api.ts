import { healthResponseSchema, type HealthResponse } from '@eventpass/shared';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`API respondeu ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}
