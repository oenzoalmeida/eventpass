import { getNetlifyHandler } from '../../src/netlify.js';

// Handler web padrão do Netlify: atende /api/* conforme o config.path abaixo.
export default async function handler(req: Request): Promise<Response> {
  return (await getNetlifyHandler())(req);
}

export const config = { path: '/api/*' };
