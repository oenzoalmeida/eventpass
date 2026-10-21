import type { FastifyReply } from 'fastify';
import type { ZodError } from 'zod';
export function sendValidationError(
  reply: FastifyReply,
  error: ZodError,
  message = 'Dados inválidos.',
) {
  return reply.code(400).send({
    error: 'validation_error',
    message,
    issues: error.flatten().fieldErrors,
  });
}
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly payload: { error: string; message: string; issues?: Record<string, string[]> },
  ) {
    super(payload.message);
  }
}
export function sendError(
  _reply: FastifyReply,
  code: number,
  error: string,
  message: string,
): never {
  throw new HttpError(code, { error, message });
}
/** Lê um parâmetro numérico de rota; devolve null se não for inteiro positivo. */
export function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export const nowIso = () => new Date().toISOString();
