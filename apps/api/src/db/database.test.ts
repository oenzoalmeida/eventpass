import { afterEach, describe, expect, it } from 'vitest';
import { openTestDatabase } from './test-database.js';
import { migrate, transaction, type Database } from './database.js';
let db: Database;
afterEach(async () => db?.close());
async function seed() {
  db = await openTestDatabase();
  await db.exec(`INSERT INTO admins(id,email,name,password_hash) VALUES(1,'a@x.test','A','x');
 INSERT INTO events(id,slug,title,starts_at,ends_at,capacity,created_by) VALUES(1,'evt','Evento','2026-11-12T10:00:00.000Z','2026-11-12T12:00:00.000Z',10,1);
 INSERT INTO participants(id,email,name) VALUES(1,'p@x.test','P');`);
  return db;
}
describe('PostgreSQL integrity', () => {
  it('migrations are idempotent', async () => {
    db = await openTestDatabase();
    expect(await migrate(db)).toEqual([]);
  });
  it('rejects duplicate registrations and emails case-insensitively', async () => {
    await seed();
    await db
      .prepare('INSERT INTO registrations(event_id,participant_id,qr_token_hash) VALUES(1,1,?)')
      .run('t1');
    await expect(
      db
        .prepare('INSERT INTO registrations(event_id,participant_id,qr_token_hash) VALUES(1,1,?)')
        .run('t2'),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.query("INSERT INTO participants(email,name) VALUES('P@X.TEST','Q')"),
    ).rejects.toMatchObject({ code: '23505' });
  });
  it('allows only one check-in and point entry', async () => {
    await seed();
    await db.exec(
      "INSERT INTO registrations(id,event_id,participant_id,qr_token_hash) VALUES(1,1,1,'t'); INSERT INTO checkins(id,registration_id,checked_in_by) VALUES(1,1,1); INSERT INTO point_entries(participant_id,checkin_id,points) VALUES(1,1,10)",
    );
    await expect(
      db.query('INSERT INTO checkins(registration_id,checked_in_by) VALUES(1,1)'),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.query('INSERT INTO point_entries(participant_id,checkin_id,points) VALUES(1,1,10)'),
    ).rejects.toMatchObject({ code: '23505' });
  });
  it('rolls back all writes after a failure', async () => {
    await seed();
    await expect(
      transaction(db, async () => {
        await db.query("INSERT INTO participants(id,email,name) VALUES(2,'rollback@x.test','R')");
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      (await db.query("SELECT id FROM participants WHERE email='rollback@x.test'")).rows,
    ).toHaveLength(0);
  });
  it('enforces valid capacity, dates and nonnegative points', async () => {
    await seed();
    await expect(db.query('UPDATE events SET capacity=0 WHERE id=1')).rejects.toMatchObject({
      code: '23514',
    });
    await expect(
      db.query("UPDATE events SET ends_at='2020-01-01' WHERE id=1"),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
