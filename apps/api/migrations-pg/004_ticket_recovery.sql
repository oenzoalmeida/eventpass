CREATE TABLE ticket_recovery_requests (
 id SERIAL PRIMARY KEY,
 registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 used_at TEXT
);
CREATE INDEX ticket_recovery_registration_idx ON ticket_recovery_requests(registration_id, created_at);
