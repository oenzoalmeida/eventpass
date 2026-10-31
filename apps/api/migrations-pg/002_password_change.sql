-- Espelho PostgreSQL do 002_password_change.sql (SQLite).
ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
