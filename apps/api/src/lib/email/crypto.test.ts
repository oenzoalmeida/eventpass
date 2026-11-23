import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decodeEmailKey, decryptEmailPayload, encryptEmailPayload } from './crypto.js';

const key = randomBytes(32);
describe('email payload AES-256-GCM', () => {
  it('round-trips and uses a fresh nonce for each message', () => {
    const context = 'registration_confirmation:registration:42:v1';
    const x = encryptEmailPayload('{"token":"private"}', key, context);
    const y = encryptEmailPayload('{"token":"private"}', key, context);
    expect(x).not.toBe(y);
    expect(x).not.toContain('private');
    expect(decryptEmailPayload(x, key, context)).toBe('{"token":"private"}');
  });
  it('rejects tampering, incorrect context and incorrect key', () => {
    const envelope = encryptEmailPayload('secret', key, 'registration:1');
    expect(() => decryptEmailPayload(envelope, key, 'registration:2')).toThrow();
    expect(() => decryptEmailPayload(envelope, randomBytes(32), 'registration:1')).toThrow();
    const pieces = envelope.split('.');
    pieces[2] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptEmailPayload(pieces.join('.'), key, 'registration:1')).toThrow();
  });
  it('requires an exactly 32-byte canonical base64 key', () => {
    expect(decodeEmailKey(key.toString('base64'))).toEqual(key);
    expect(() => decodeEmailKey('not-a-key')).toThrow();
  });
});
