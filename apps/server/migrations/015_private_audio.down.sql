-- Fail closed if large MP3 originals exist; restore the pre-cutover backup to undo them.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM private_objects WHERE byte_size > 1048576) THEN
    RAISE EXCEPTION 'Large private audio objects require reconciliation before schema rollback';
  END IF;
END $$;
ALTER TABLE private_objects DROP CONSTRAINT private_objects_byte_size_check;
ALTER TABLE private_objects ADD CONSTRAINT private_objects_byte_size_check
  CHECK (byte_size BETWEEN 0 AND 1048576);
