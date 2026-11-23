import type { EmailMessage, EmailProvider } from './provider.js';

export interface ResendConfig {
  apiKey: string;
  from: string;
  /** External delivery must only be constructed in a separately approved execution environment. */
  enabled: boolean;
  timeoutMs?: number;
}

/**
 * Resend adapter using Node's built-in fetch: no new runtime dependency.
 * This class is never instantiated by the EventPass application in this branch.
 */
export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly config: ResendConfig,
    private readonly http: typeof fetch = fetch,
  ) {
    if (!config.enabled) throw new Error('Email delivery is disabled');
    if (!config.apiKey || !config.from) throw new Error('Missing email provider configuration');
  }

  async send(message: EmailMessage, idempotencyKey: string): Promise<void> {
    if (!message.to || !message.subject || !message.html || !message.text) {
      throw new Error('Incomplete email message');
    }
    if (!idempotencyKey || idempotencyKey.length > 256) throw new Error('Invalid idempotency key');

    // Never log authorization headers, provider response bodies, or message content.
    const response = await this.http('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: this.config.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 10_000),
    });
    if (!response.ok) {
      // No response body: it might contain sensitive provider-side metadata.
      throw new Error(`Email delivery failed with HTTP ${response.status}`);
    }
  }
}
