import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const guard = resolve(root, 'scripts/lib/assert-local-target.mjs');

function check(target: string): { ok: boolean; out: string } {
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import { assertLocalTarget } from ${JSON.stringify(guard)}; console.log(assertLocalTarget(process.argv[1]))`, target],
    { encoding: 'utf8' },
  );
  return { ok: r.status === 0, out: r.stdout + r.stderr };
}

describe('trava de alvo da suíte E2E', () => {
  it.each(['http://localhost:8877', 'http://127.0.0.1:3000', 'http://[::1]:8877'])('aceita loopback %s', (t) => {
    expect(check(t).ok).toBe(true);
  });

  it.each([
    'https://example.netlify.app',
    'https://eventpass.example',
    'http://localhost.evil.example',
    'http://127.0.0.1.nip.io',
    'http://localhost@evil.example',
    'http://user:pw@localhost:8877',
    'ftp://localhost',
    'nao-e-url',
    '',
  ])('recusa %s', (t) => {
    expect(check(t).ok).toBe(false);
  });

  it('o script E2E sai com código 2 antes de qualquer requisição quando BASE_URL é remota', () => {
    const r = spawnSync(process.execPath, [resolve(root, 'scripts/e2e-homolog.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, BASE_URL: 'https://example.invalid', ALLOW_REMOTE_E2E: '1', E2E_ALLOW_REMOTE: 'true' },
      timeout: 15000,
    });
    expect(r.status).toBe(2);
    expect(r.stdout).not.toContain('ok ');
    expect(r.stderr).toContain('recusado');
  });
});
