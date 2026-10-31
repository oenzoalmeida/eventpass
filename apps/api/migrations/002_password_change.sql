-- Troca de senha obrigatória no primeiro acesso (senha temporária criada por admin:create).
ALTER TABLE admins ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
