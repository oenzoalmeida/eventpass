import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';

/** 32-byte key in base64. Never use a session/JWT secret for email payload encryption. */
export function decodeEmailKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) {
    throw new Error('Invalid email encryption key: expected canonical base64 of 32 bytes');
  }
  return key;
}

export function encryptEmailPayload(plaintext: string, key: Buffer, context: string): string {
  if (key.length !== 32 || !context || !plaintext) throw new Error('Invalid encryption inputs');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, nonce.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

export function decryptEmailPayload(envelope: string, key: Buffer, context: string): string {
  if (key.length !== 32 || !context) throw new Error('Invalid decryption inputs');
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error('Invalid email envelope');
  const nonce = Buffer.from(parts[1]!, 'base64url');
  const payload = Buffer.from(parts[2]!, 'base64url');
  const tag = Buffer.from(parts[3]!, 'base64url');
  if (nonce.length !== 12 || tag.length !== 16 || payload.length === 0) throw new Error('Invalid email envelope');
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
}
