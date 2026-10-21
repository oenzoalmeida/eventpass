import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '../db/database.js';
import type { AdminProfile } from '@eventpass/shared';
export const SESSION_COOKIE = 'ep_session';
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export async function createSession(db: Database, adminId: number, ttlHours: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlHours * 3600000);
  await db
    .prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), adminId, expiresAt.toISOString());
  return { token, expiresAt };
}
export async function findSessionAdmin(db: Database, token: string): Promise<AdminProfile | null> {
  const row = (await db
    .prepare(
      `SELECT a.id, a.email, a.name FROM sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), new Date().toISOString())) as AdminProfile | undefined;
  return row ?? null;
}
export async function deleteSession(db: Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}
export async function purgeExpiredSessions(db: Database): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}
