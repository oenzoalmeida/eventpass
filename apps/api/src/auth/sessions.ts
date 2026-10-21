import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '../db/database.js';
import type { AdminProfile } from '@eventpass/shared';

export const SESSION_COOKIE = 'ep_session';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function createSession(db: Database, adminId: number, ttlHours: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(
    sha256(token),
    adminId,
    expiresAt.toISOString(),
  );
  return { token, expiresAt };
}

export function findSessionAdmin(db: Database, token: string): AdminProfile | null {
  const row = db
    .prepare(
      `SELECT a.id, a.email, a.name FROM sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), new Date().toISOString()) as AdminProfile | undefined;
  return row ?? null;
}

export function deleteSession(db: Database, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function purgeExpiredSessions(db: Database): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}
