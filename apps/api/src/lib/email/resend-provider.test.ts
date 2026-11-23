import { describe, expect, it, vi } from 'vitest';
import { ResendEmailProvider } from './resend-provider.js';

const message = {
  to: 'participante@exemplo.test',
  subject: 'Ingresso',
  html: '<p>Ingresso</p>',
  text: 'Ingresso',
};

describe('Resend provider (mock transport; no network)', () => {
  it('blocks construction when disabled or unconfigured', () => {
    expect(() => new ResendEmailProvider({ apiKey: '', from: '', enabled: false })).toThrow();
    expect(() => new ResendEmailProvider({ apiKey: '', from: '', enabled: true })).toThrow();
  });

  it('sets idempotency key and sends to a fixed endpoint', async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }));
    const provider = new ResendEmailProvider(
      { apiKey: 'test-only', from: 'EventPass <ingressos@example.test>', enabled: true },
      http as typeof fetch,
    );
    await provider.send(message, 'registration:42:v1');
    expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('registration:42:v1');
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: ['participante@exemplo.test'], subject: 'Ingresso',
    });
  });

  it('does not expose provider response content on errors', async () => {
    const http = vi.fn(async () => new Response('private provider details', { status: 422 }));
    const provider = new ResendEmailProvider(
      { apiKey: 'test-only', from: 'ingressos@example.test', enabled: true },
      http as typeof fetch,
    );
    await expect(provider.send(message, 'registration:42:v1')).rejects.toThrow('HTTP 422');
  });
});
