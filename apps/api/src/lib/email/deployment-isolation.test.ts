import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe,expect,it } from 'vitest';
describe('correction branch isolation',()=>{
 it('disables only its Vercel branch and keeps CI enabled without Netlify deployment trigger',()=>{
  const root=fileURLToPath(new URL('../../../../..',import.meta.url));
  const cfg=JSON.parse(readFileSync(root+'/vercel.json','utf8'));
  expect(cfg.git.deploymentEnabled).toEqual({'fix/email-homologation-20261123':false});
  expect(readFileSync(root+'/.github/workflows/ci.yml','utf8')).toContain('fix/email-homologation-20261123');
  expect(readFileSync(root+'/.github/workflows/deploy-homolog.yml','utf8')).not.toContain('fix/email-homologation-20261123');
 });
});
