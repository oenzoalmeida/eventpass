import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const guard = resolve(root, 'scripts/lib/assert-local-target.mjs');
const barrier = resolve(__dirname, 'test-support/block-network.mjs');

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

  it('controle negativo: a barreira de rede aborta fetch e socket (código 99) sem sair da máquina', () => {
    for (const code of [
      "await fetch('https://example.invalid/')",
      "const net = await import('node:net'); net.connect(80, 'example.invalid')",
      "const dns = await import('node:dns'); dns.lookup('example.invalid', () => {})",
    ]) {
      const r = spawnSync(process.execPath, ['--import', barrier, '--input-type=module', '-e', code], { encoding: 'utf8', timeout: 15000 });
      expect(r.status).toBe(99);
      expect(r.stderr).toContain('NETWORK_BARRIER_HIT');
    }
  });

  it('o script E2E sai com código 2 e a barreira nunca é acionada quando BASE_URL é remota', () => {
    const r = spawnSync(process.execPath, ['--import', barrier, resolve(root, 'scripts/e2e-homolog.mjs')], {
      encoding: 'utf8',
      env: { ...process.env, BASE_URL: 'https://example.invalid', ALLOW_REMOTE_E2E: '1', E2E_ALLOW_REMOTE: 'true' },
      timeout: 15000,
    });
    expect(r.status).toBe(2);
    expect(r.stderr).not.toContain('NETWORK_BARRIER_HIT');
    expect(r.stdout).not.toContain('ok ');
    expect(r.stderr).toContain('recusado');
  });

  it('mutação: sem a trava, a barreira ainda impede a saída (script sem guarda aborta com 99)', () => {
    const src = readFileSync(resolve(root, 'scripts/e2e-homolog.mjs'), 'utf8')
      .replace(/import \{ assertLocalTarget \}[^\n]*\n/, '')
      .replace(/assertLocalTarget\(/, '((x) => x)(');
    expect(src).not.toContain('assertLocalTarget');
    const dir = mkdtempSync(join(tmpdir(), 'e2e-mut-'));
    const file = join(dir, 'mut.mjs');
    writeFileSync(file, src);
    const r = spawnSync(process.execPath, ['--import', barrier, file], {
      encoding: 'utf8',
      env: { ...process.env, BASE_URL: 'https://example.invalid' },
      timeout: 15000,
    });
    expect(r.status).toBe(99);
    expect(r.stderr).toContain('NETWORK_BARRIER_HIT');
  });
});
