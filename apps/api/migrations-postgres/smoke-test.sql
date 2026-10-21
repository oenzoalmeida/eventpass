-- PostgreSQL integration smoke test; executed only against disposable CI database.
BEGIN;
INSERT INTO admins (id,email,name,password_hash) VALUES (1001,'Admin@Example.com','Admin','test-hash');
INSERT INTO events (id,slug,title,starts_at,ends_at,capacity,created_by)
VALUES (2001,'smoke','Smoke event','2026-10-21T10:00:00.000Z','2026-10-21T12:00:00.000Z',2,1001);
INSERT INTO participants (id,email,name) VALUES (3001,'Person@Example.com','Person');
INSERT INTO registrations (id,event_id,participant_id,qr_token_hash)
VALUES (4001,2001,3001,'ticket-hash');
INSERT INTO checkins (id,registration_id,checked_in_by) VALUES (5001,4001,1001);
INSERT INTO point_entries (participant_id,checkin_id,points) VALUES (3001,5001,10);

DO $$
BEGIN
 IF (SELECT count(*) FROM registrations WHERE event_id=2001) <> 1 THEN
  RAISE EXCEPTION 'Registration not persisted';
 END IF;
 IF (SELECT sum(points) FROM point_entries WHERE participant_id=3001) <> 10 THEN
  RAISE EXCEPTION 'Points not persisted';
 END IF;
END $$;

DO $$
BEGIN
 BEGIN
  INSERT INTO participants (email,name) VALUES ('person@example.com','Duplicate');
  RAISE EXCEPTION 'Email uniqueness not enforced';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO registrations (event_id,participant_id,qr_token_hash)
  VALUES (2001,3001,'another-ticket');
  RAISE EXCEPTION 'Registration uniqueness not enforced';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO checkins (registration_id,checked_in_by) VALUES (4001,1001);
  RAISE EXCEPTION 'Check-in uniqueness not enforced';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO point_entries (participant_id,checkin_id,points) VALUES (3001,5001,10);
  RAISE EXCEPTION 'Points uniqueness not enforced';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO point_entries (participant_id,checkin_id,points) VALUES (3001,5001,-1);
  RAISE EXCEPTION 'Negative points accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 WHEN unique_violation THEN NULL;
 END;
END $$;
ROLLBACK;
