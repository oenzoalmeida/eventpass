-- Espelho PostgreSQL da fila SQLite, sem envio habilitado.
CREATE TABLE email_outbox (
  id SERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('registration_confirmation', 'ticket_recovery')),
  recipient_email TEXT NOT NULL,
  payload_ciphertext TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  lease_token TEXT,
  sent_at TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX email_outbox_ready_idx ON email_outbox(status, next_attempt_at);
