CREATE FUNCTION eventpass_point_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM checkins c JOIN registrations r ON r.id=c.registration_id
   WHERE c.id=NEW.checkin_id AND r.participant_id=NEW.participant_id
 ) THEN RAISE EXCEPTION 'Point entry does not belong to registration participant' USING ERRCODE='23503'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER point_entries_owner BEFORE INSERT OR UPDATE ON point_entries FOR EACH ROW EXECUTE FUNCTION eventpass_point_owner();
