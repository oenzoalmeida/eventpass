CREATE TABLE rate_limits (
 key TEXT NOT NULL, window_id BIGINT NOT NULL, hits INTEGER NOT NULL CHECK (hits > 0), expires_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY (key, window_id)
);
CREATE INDEX rate_limits_expires_idx ON rate_limits(expires_at);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);
CREATE INDEX events_public_idx ON events(status, ends_at, starts_at);
CREATE INDEX registrations_participant_idx ON registrations(participant_id);
