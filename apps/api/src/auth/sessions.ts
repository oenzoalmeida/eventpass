import { createHash, randomBytes } from 'node:crypto';
import type { AdminProfile } from '@eventpass/shared';
import type { DbClient } from '../db/client.js';

export const SESSION_COOKIE = 'ep_session';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export async function createSession(db: DbClient, adminId: number, ttlHours: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  await db.run('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)', [
    sha256(token),
    adminId,
    expiresAt.toISOString(),
  ]);
  return { token, expiresAt };
}

export async function findSessionAdmin(db: DbClient, token: string): Promise<AdminProfile | null> {
  const row = await db.get<{ id: number; email: string; name: string; must_change_password: number | boolean }>(
    `SELECT a.id, a.email, a.name, a.must_change_password FROM sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [sha256(token), new Date().toISOString()],
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    mustChangePassword: row.must_change_password === 1 || row.must_change_password === true,
  };
}

export async function deleteSession(db: DbClient, token: string): Promise<void> {
  await db.run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
}

export async function purgeExpiredSessions(db: DbClient): Promise<void> {
  await db.run('DELETE FROM sessions WHERE expires_at <= ?', [new Date().toISOString()]);
}
