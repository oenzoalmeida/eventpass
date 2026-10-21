import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../apps/api/src/app.js';
import { openDatabase } from '../apps/api/src/db/database.js';
import type { Database } from '../apps/api/src/db/database.js';
import type { Env } from '../apps/api/src/env.js';
import { loadEnv } from '../apps/api/src/env.js';
export function createHandler(env: Env, db: Database) {
  let ready: ReturnType<typeof buildApp> | undefined;
  return async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
      ready ??= buildApp(env, db);
      const app = await ready;
      await app.ready();
      const url = new URL(req.url ?? '/', 'https://eventpass.invalid');
      if (url.searchParams.has('__path')) {
        const route = url.searchParams.get('__path')!;
        url.searchParams.delete('__path');
        req.url = '/api/' + route + url.search;
      }
      app.server.emit('request', req, res);
    } catch {
      ready = undefined;
      res.statusCode = 503;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({ error: 'unavailable', message: 'Serviço temporariamente indisponível.' }),
      );
    }
  };
}
let handler: ReturnType<typeof createHandler> | undefined;
export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  handler ??= createHandler(loadEnv(), openDatabase(loadEnv().DATABASE_URL));
  return handler(req, res);
}
