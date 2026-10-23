-- Restore only after all draft jobs/artifacts have been retired.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM vegalaunch_build.jobs WHERE build_kind <> 'published') THEN
    RAISE EXCEPTION 'Draft jobs remain; preserve their receipts before rollback';
  END IF;
END $$;
ALTER TABLE vegalaunch_build.jobs
  DROP CONSTRAINT build_jobs_identity_kind,
  ALTER COLUMN release_id SET NOT NULL,
  ALTER COLUMN release_sequence SET NOT NULL,
  DROP COLUMN draft_snapshot_sha256,
  DROP COLUMN draft_revision,
  DROP COLUMN build_kind;
COMMIT;
