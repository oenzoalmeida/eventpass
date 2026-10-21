import type { FastifyReply } from 'fastify';
import type { ZodError } from 'zod';

export function sendValidationError(reply: FastifyReply, error: ZodError, message = 'Dados inválidos.') {
  return reply.code(400).send({
    error: 'validation_error',
    message,
    issues: error.flatten().fieldErrors,
  });
}

export function sendError(reply: FastifyReply, code: number, error: string, message: string) {
  return reply.code(code).send({ error, message });
}

/** Lê um parâmetro numérico de rota; devolve null se não for inteiro positivo. */
export function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const nowIso = () => new Date().toISOString();
