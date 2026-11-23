import { decodeEmailKey, decryptEmailPayload, encryptEmailPayload } from './crypto.js';
import type { EmailKind, EmailMessage } from './provider.js';
import { renderEmail, type EmailContent } from './content.js';

export function encryptNotification(payload: EmailContent, keyBase64: string, idempotencyKey: string): string {
  return encryptEmailPayload(JSON.stringify(payload), decodeEmailKey(keyBase64), idempotencyKey);
}
export function decryptAndRenderNotification(
  kind: EmailKind, recipient: string, ciphertext: string, keyBase64: string, idempotencyKey: string,
): Promise<EmailMessage> {
  const raw: unknown = JSON.parse(decryptEmailPayload(ciphertext, decodeEmailKey(keyBase64), idempotencyKey));
  if (!raw || typeof raw !== 'object') throw new Error('Invalid notification payload');
  const p = raw as Record<string, unknown>;
  if (typeof p.participantName !== 'string' || typeof p.eventTitle !== 'string' || typeof p.link !== 'string') {
    throw new Error('Invalid notification payload');
  }
  return renderEmail(kind, { participantName: p.participantName, eventTitle: p.eventTitle, link: p.link }, recipient);
}
