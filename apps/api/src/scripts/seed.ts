import { loadEnv } from '../env.js';
import { migrate, openDatabase, transaction } from '../db/database.js';
import { slugify } from '../lib/slug.js';
import { newTicketToken } from '../lib/tickets.js';
/**
 * Popula o banco local com dados FICTÍCIOS para demonstração.
 * Requer um administrador criado antes (npm run admin:create).
 * Recusa rodar em produção.
 */
const env = loadEnv();
if (env.NODE_ENV === 'production') {
  console.error('Seed de demonstração não roda em produção.');
  process.exit(1);
}
const db = openDatabase(env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL);
await migrate(db);
const admin = (await db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get()) as
  | {
      id: number;
    }
  | undefined;
if (!admin) {
  console.error('Crie um administrador primeiro: npm run admin:create');
  process.exit(1);
}
const day = (d: number, h: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
};
const events = [
  {
    title: 'Workshop de React acessível',
    location: 'Laboratório 3',
    s: day(3, 14),
    e: day(3, 17),
    cap: 30,
    pts: 20,
    status: 'published',
  },
  {
    title: 'Palestra: Carreira em tecnologia',
    location: 'Auditório principal',
    s: day(7, 19),
    e: day(7, 21),
    cap: 120,
    pts: 10,
    status: 'published',
  },
  {
    title: 'Hackathon de fim de semestre',
    location: 'Bloco B',
    s: day(14, 9),
    e: day(15, 18),
    cap: 60,
    pts: 50,
    status: 'draft',
  },
  {
    title: 'Encontro de boas-vindas',
    location: 'Pátio central',
    s: day(-10, 10),
    e: day(-10, 12),
    cap: 80,
    pts: 10,
    status: 'closed',
  },
];
const names = [
  'Ana Souza',
  'Bruno Lima',
  'Carla Mendes',
  'Diego Rocha',
  'Elisa Prado',
  'Fábio Nunes',
  'Gabi Torres',
  'Hugo Alves',
];
await transaction(db, async () => {
  for (const ev of events) {
    const r = await db
      .prepare(
        `INSERT INTO events (slug, title, description, location, starts_at, ends_at, capacity, checkin_points, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slugify(ev.title),
        ev.title,
        'Evento de demonstração com dados fictícios.',
        ev.location,
        ev.s,
        ev.e,
        ev.cap,
        ev.pts,
        ev.status,
        admin.id,
      );
    const eventId = Number(r.lastInsertRowid);
    if (ev.status === 'draft') continue;
    for (const [i, name] of names.entries()) {
      const email = `${name.split(' ')[0]!.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@exemplo.test`;
      await db
        .prepare(
          'INSERT INTO participants (email, name) VALUES (?, ?) ON CONFLICT (lower(email)) DO NOTHING',
        )
        .run(email, name);
      const p = (await db
        .prepare('SELECT id FROM participants WHERE lower(email) = lower(?)')
        .get(email)) as {
        id: number;
      };
      const reg = await db
        .prepare(
          'INSERT INTO registrations (event_id, participant_id, qr_token_hash) VALUES (?, ?, ?)',
        )
        .run(eventId, p.id, newTicketToken().hash);
      // No evento passado, a maioria compareceu.
      if (ev.status === 'closed' && i % 4 !== 3) {
        const at = new Date(new Date(ev.s).getTime() + i * 7 * 60000).toISOString();
        const c = await db
          .prepare(
            'INSERT INTO checkins (registration_id, checked_in_by, created_at) VALUES (?, ?, ?)',
          )
          .run(Number(reg.lastInsertRowid), admin.id, at);
        await db
          .prepare(
            'INSERT INTO point_entries (participant_id, checkin_id, points, created_at) VALUES (?, ?, ?, ?)',
          )
          .run(p.id, Number(c.lastInsertRowid), ev.pts, at);
      }
    }
  }
});
console.log(`${events.length} eventos de demonstração criados (dados fictícios).`);
await db.close();
