-- Espelho PostgreSQL do 001_initial.sql (SQLite), para Neon.
-- Datas continuam em texto ISO 8601 UTC para manter paridade com a versão SQLite.
-- E-mails são normalizados para minúsculas pelos schemas Zod; o UNIQUE cobre o resto.

CREATE TABLE admins (
  id            SERIAL PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

-- Guardamos apenas o hash SHA-256 do token; o token em si vive só no cookie.
CREATE TABLE sessions (
  id         SERIAL PRIMARY KEY,
  token_hash TEXT    NOT NULL UNIQUE,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX sessions_admin_idx ON sessions(admin_id);

CREATE TABLE events (
  id             SERIAL PRIMARY KEY,
  slug           TEXT    NOT NULL UNIQUE,
  title          TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  location       TEXT    NOT NULL DEFAULT '',
  starts_at      TEXT    NOT NULL,
  ends_at        TEXT    NOT NULL,
  capacity       INTEGER NOT NULL CHECK (capacity > 0),
  checkin_points INTEGER NOT NULL DEFAULT 10 CHECK (checkin_points >= 0),
  status         TEXT    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_by     INTEGER NOT NULL REFERENCES admins(id),
  created_at     TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at     TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  CHECK (ends_at >= starts_at)
);

-- Participante identificado pelo e-mail; acumula pontos entre eventos.
CREATE TABLE participants (
  id         SERIAL PRIMARY KEY,
  email      TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

-- UNIQUE(event_id, participant_id) impede inscrição duplicada mesmo com requisições concorrentes.
CREATE TABLE registrations (
  id             SERIAL PRIMARY KEY,
  event_id       INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  qr_token_hash  TEXT    NOT NULL UNIQUE,
  status         TEXT    NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at     TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  UNIQUE (event_id, participant_id)
);
CREATE INDEX registrations_event_idx ON registrations(event_id);

-- Um check-in por inscrição.
CREATE TABLE checkins (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
  checked_in_by   INTEGER NOT NULL REFERENCES admins(id),
  created_at      TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);

-- Pontos só existem atrelados a um check-in válido (no máximo um lançamento por check-in).
CREATE TABLE point_entries (
  id             SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  checkin_id     INTEGER NOT NULL UNIQUE REFERENCES checkins(id) ON DELETE CASCADE,
  points         INTEGER NOT NULL CHECK (points >= 0),
  created_at     TEXT    NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
CREATE INDEX point_entries_participant_idx ON point_entries(participant_id);
