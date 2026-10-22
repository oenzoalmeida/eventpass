import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { openDb } from './db/index.js';

/**
 * Adaptador para Netlify Functions (handler web padrão Request/Response).
 *
 * O app Fastify é construído uma vez por instância da lambda e reutilizado
 * entre invocações; as sessões ficam no banco (não em memória), então o
 * login persiste entre invocações e instâncias frias.
 */
let handlerPromise: Promise<(req: Request) => Promise<Response>> | undefined;

export function getNetlifyHandler(): Promise<(req: Request) => Promise<Response>> {
  handlerPromise ??= (async () => {
    const env = loadEnv({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'production' });
    const { db } = await openDb(env);
    const app = await buildApp(env, db);
    return async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const hasBody = !['GET', 'HEAD'].includes(req.method);
      const payload = hasBody ? await req.text() : undefined;

      const res = await app.inject({
        method: req.method,
        url: `${url.pathname}${url.search}`,
        headers,
        payload,
      });

      const outHeaders = new Headers();
      for (const [key, value] of Object.entries(res.headers)) {
        if (Array.isArray(value)) value.forEach((v) => outHeaders.append(key, v));
        else if (value != null) outHeaders.set(key, String(value));
      }
      return new Response(new Uint8Array(res.rawPayload), {
        status: res.statusCode,
        headers: outHeaders,
      });
    };
  })();
  return handlerPromise;
}
