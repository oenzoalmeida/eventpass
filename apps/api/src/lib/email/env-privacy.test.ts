import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../env.js';

describe('environment validation privacy', () => {
  it('never includes invalid secret values in its error', () => {
    const secret = 'private-invalid-mail-value';
    try { loadEnv({ EMAIL_PUBLIC_BASE_URL: secret }); throw new Error('expected rejection'); }
    catch (error) { expect(String(error)).not.toContain(secret); }
  });
});
