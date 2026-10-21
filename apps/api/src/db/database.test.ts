import { describe, expect, it } from 'vitest';
import { migrate, openDatabase } from './database.js';

function seed() {
  const db = openDatabase(':memory:');
  migrate(db);
  db.exec(`
    INSERT INTO admins (id, email, name, password_hash) VALUES (1, 'a@x.test', 'A', 'x');
    INSERT INTO events (id, slug, title, starts_at, ends_at, capacity, created_by)
      VALUES (1, 'evt', 'Evento', '2026-11-12T10:00:00Z', '2026-11-12T12:00:00Z', 10, 1);
    INSERT INTO participants (id, email, name) VALUES (1, 'p@x.test', 'P');
  `);
  return db;
}

describe('migrações', () => {
  it('são idempotentes', () => {
    const db = openDatabase(':memory:');
    expect(migrate(db)).toEqual(['001_initial.sql']);
    expect(migrate(db)).toEqual([]);
  });
});

describe('integridade do banco', () => {
  it('impede inscrição duplicada no mesmo evento', () => {
    const db = seed();
    const ins = db.prepare(
      'INSERT INTO registrations (event_id, participant_id, qr_token_hash) VALUES (1, 1, ?)',
    );
    ins.run('t1');
    expect(() => ins.run('t2')).toThrow(/UNIQUE/);
  });

  it('trata e-mail sem diferenciar maiúsculas', () => {
    const db = seed();
    expect(() =>
      db.prepare("INSERT INTO participants (email, name) VALUES ('P@X.TEST', 'Q')").run(),
    ).toThrow(/UNIQUE/);
  });

  it('permite só um check-in e um lançamento de pontos por inscrição', () => {
    const db = seed();
    db.exec(`
      INSERT INTO registrations (id, event_id, participant_id, qr_token_hash) VALUES (1, 1, 1, 't');
      INSERT INTO checkins (id, registration_id, checked_in_by) VALUES (1, 1, 1);
      INSERT INTO point_entries (participant_id, checkin_id, points) VALUES (1, 1, 10);
    `);
    expect(() => db.exec('INSERT INTO checkins (registration_id, checked_in_by) VALUES (1, 1)')).toThrow(/UNIQUE/);
    expect(() => db.exec('INSERT INTO point_entries (participant_id, checkin_id, points) VALUES (1, 1, 10)')).toThrow(/UNIQUE/);
  });

  it('rejeita evento com vagas inválidas ou fim antes do início', () => {
    const db = seed();
    const ins = db.prepare(
      "INSERT INTO events (slug, title, starts_at, ends_at, capacity, created_by) VALUES (?, 'E', ?, ?, ?, 1)",
    );
    expect(() => ins.run('a', '2026-01-01', '2026-01-02', 0)).toThrow(/CHECK/);
    expect(() => ins.run('b', '2026-01-02', '2026-01-01', 5)).toThrow(/CHECK/);
  });
});
