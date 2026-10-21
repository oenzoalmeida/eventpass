import type { AdminEvent, PublicEvent } from '@eventpass/shared';
import type { Database } from '../db/database.js';
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
  registrations: number;
  checkins: number;
}
const SELECT_EVENT = `
  SELECT e.*,
    (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS registrations,
    (SELECT COUNT(*) FROM checkins c JOIN registrations r ON r.id = c.registration_id
      WHERE r.event_id = e.id) AS checkins
  FROM events e`;
export function toAdminEvent(r: EventRow): AdminEvent {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    location: r.location,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    capacity: r.capacity,
    checkinPoints: r.checkin_points,
    status: r.status,
    registrations: r.registrations,
    checkins: r.checkins,
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
  db: Database,
  where = '',
  params: Array<string | number> = [],
): Promise<AdminEvent[]> {
  return (
    (await db.prepare(`${SELECT_EVENT} ${where}`).all(...params)) as unknown as EventRow[]
  ).map(toAdminEvent);
}
export async function getEventById(
  db: Database,
  id: number,
  lock = false,
): Promise<AdminEvent | null> {
  if (lock) await db.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [id]);
  const row = (await db.prepare(`${SELECT_EVENT} WHERE e.id = ?`).get(id)) as EventRow | undefined;
  return row ? toAdminEvent(row) : null;
}
export async function getEventBySlug(
  db: Database,
  slug: string,
  lock = false,
): Promise<AdminEvent | null> {
  if (lock) await db.query('SELECT id FROM events WHERE slug = $1 FOR UPDATE', [slug]);
  const row = (await db.prepare(`${SELECT_EVENT} WHERE e.slug = ?`).get(slug)) as
    EventRow | undefined;
  return row ? toAdminEvent(row) : null;
}
