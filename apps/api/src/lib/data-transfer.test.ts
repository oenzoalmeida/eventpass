import { afterEach, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { openTestDatabase } from '../db/test-database.js';
import { type Database } from '../db/database.js';
import {
  encryptBackup,
  decryptBackup,
  snapshot,
  importSnapshot,
  type Snapshot,
} from './data-transfer.js';
const dbs: Database[] = [];
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.close();
});
it('encrypts backups and rejects wrong keys and tampered ciphertext', () => {
  const data: Snapshot = { version: 1, tables: { admins: [{ email: 'private@example.test' }] } };
  const key = randomBytes(32).toString('hex');
  const backup = encryptBackup(data, key);
  expect(backup.toString()).not.toContain('private@example.test');
  expect(decryptBackup(backup, key)).toEqual(data);
  expect(() => decryptBackup(backup, randomBytes(32).toString('hex'))).toThrow();
  backup[backup.length - 1] = backup[backup.length - 1]! ^ 1;
  expect(() => decryptBackup(backup, key)).toThrow();
});
it('round trips IDs, credentials, tickets and points without overwriting existing data', async () => {
  const source = await openTestDatabase();
  const target = await openTestDatabase();
  dbs.push(source, target);
  await source.exec(`INSERT INTO admins(id,email,name,password_hash) VALUES(9,'a@x.test','A','preserved-hash');
 INSERT INTO sessions(token_hash,admin_id,expires_at) VALUES('session-hash',9,'2027-01-01T00:00:00.000Z');
 INSERT INTO events(id,slug,title,starts_at,ends_at,capacity,created_by) VALUES(8,'evt','Evento','2026-12-01T00:00:00.000Z','2026-12-02T00:00:00.000Z',2,9);
 INSERT INTO participants(id,email,name) VALUES(7,'p@x.test','Pessoa');
 INSERT INTO registrations(id,event_id,participant_id,qr_token_hash) VALUES(6,8,7,'ticket-hash');
 INSERT INTO checkins(id,registration_id,checked_in_by) VALUES(5,6,9);
 INSERT INTO point_entries(participant_id,checkin_id,points) VALUES(7,5,15);`);
  const data = await snapshot(source);
  await importSnapshot(target, decryptBackup(encryptBackup(data, 'a'.repeat(64)), 'a'.repeat(64)));
  expect(await snapshot(target)).toEqual(data);
  await expect(importSnapshot(target, data)).rejects.toThrow('Destination must be empty');
  expect(
    (
      await target.query(
        "INSERT INTO admins(email,name,password_hash) VALUES('b@x.test','B','hash') RETURNING id",
      )
    ).rows[0].id,
  ).toBe(10);
});
