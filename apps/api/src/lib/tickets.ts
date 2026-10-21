import { createHash, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';

/** Token do ingresso: aleatório, 192 bits. O banco guarda só o hash. */
export function newTicketToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashTicketToken(token) };
}

export function hashTicketToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function ticketQrSvg(token: string): Promise<string> {
  return QRCode.toString(token, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
}
