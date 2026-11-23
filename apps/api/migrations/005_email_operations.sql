-- Reservations count attempts, including ambiguous failures. Never refund automatically.
CREATE TABLE email_send_budget (
 period_key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
