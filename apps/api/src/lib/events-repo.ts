import type { AdminEvent, PublicEvent } from '@eventpass/shared';
import type { DbClient } from '../db/client.js';

interface EventRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  checkin_points: number;
  status: AdminEvent['status'];
  created_at: string;
  updated_at: string;
  registrations: number | string;
  checkins: number | string;
}

const SELECT_EVENT = `
  SELECT e.*,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registrations,
    (SELECT COUNT(*) FROM checkins c JOIN registrations r ON r.id = c.registration_id
      WHERE r.event_id = e.id) AS checkins
  FROM events e`;

export function toAdminEvent(r: EventRow): AdminEvent {
  return {
    id: Number(r.id),
    slug: r.slug,
    title: r.title,
    description: r.description,
    location: r.location,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    capacity: Number(r.capacity),
    checkinPoints: Number(r.checkin_points),
    status: r.status,
    // COUNT/SUM chegam como string no Postgres e como número no SQLite.
    registrations: Number(r.registrations),
    checkins: Number(r.checkins),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toPublicEvent(e: AdminEvent, now = new Date().toISOString()): PublicEvent {
  const spotsLeft = Math.max(0, e.capacity - e.registrations);
  return {
    slug: e.slug,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    capacity: e.capacity,
    spotsLeft,
    checkinPoints: e.checkinPoints,
    isOpen: e.status === 'published' && e.endsAt > now && spotsLeft > 0,
  };
}

export async function listEvents(
  db: DbClient,
  where = '',
  params: Array<string | number> = [],
): Promise<AdminEvent[]> {
  const rows = await db.all<EventRow>(`${SELECT_EVENT} ${where}`, params);
  return rows.map(toAdminEvent);
}

export async function getEventById(db: DbClient, id: number): Promise<AdminEvent | null> {
  const row = await db.get<EventRow>(`${SELECT_EVENT} WHERE e.id = ?`, [id]);
  return row ? toAdminEvent(row) : null;
}

export async function getEventBySlug(db: DbClient, slug: string): Promise<AdminEvent | null> {
  const row = await db.get<EventRow>(`${SELECT_EVENT} WHERE e.slug = ?`, [slug]);
  return row ? toAdminEvent(row) : null;
}
