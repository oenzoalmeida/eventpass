import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('CLI homologation package', () => {
  it('preserves both API and scheduled function without publishing', () => {
    const root = fileURLToPath(new URL('../../../../..', import.meta.url));
    const work = mkdtempSync(join(tmpdir(), 'eventpass-package-'));
    try {
      mkdirSync(work + '/apps/web/dist', { recursive: true });
      mkdirSync(work + '/scripts', { recursive: true });
      cpSync(root + '/apps/api', work + '/apps/api', { recursive: true, filter: (path) => !path.includes('node_modules') });
      cpSync(root + '/scripts/deploy-homolog.mjs', work + '/scripts/deploy-homolog.mjs');
      execFileSync(process.execPath, ['scripts/deploy-homolog.mjs', '--skip-publish'], { cwd: work });
      const worker = work + '/.deploy-netlify/functions/email-queue.ts';
      expect(existsSync(worker)).toBe(true);
      expect(readFileSync(worker, 'utf8')).toContain("'../src/scripts/email-worker.js'");
      expect(readFileSync(worker, 'utf8')).toContain("schedule: '*/5 * * * *'");
      expect(existsSync(work + '/.deploy-netlify/functions/api.ts')).toBe(true);
      expect(readFileSync(work + '/.deploy-netlify/functions/email-maintenance.ts','utf8')).toContain("schedule: '17 3 * * *'");
    } finally { rmSync(work, { recursive: true, force: true }); }
  });
});
