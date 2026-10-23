-- Separate build-queue migration; do not advance the core schema-15 ledger.
BEGIN;
ALTER TABLE vegalaunch_build.jobs
  ADD COLUMN build_kind text NOT NULL DEFAULT 'published',
  ADD COLUMN draft_revision integer,
  ADD COLUMN draft_snapshot_sha256 text,
  ALTER COLUMN release_id DROP NOT NULL,
  ALTER COLUMN release_sequence DROP NOT NULL;
ALTER TABLE vegalaunch_build.jobs ADD CONSTRAINT build_jobs_identity_kind CHECK (
  (build_kind = 'published' AND release_id IS NOT NULL AND release_sequence IS NOT NULL
    AND draft_revision IS NULL AND draft_snapshot_sha256 IS NULL) OR
  (build_kind = 'draft' AND release_id IS NULL AND release_sequence IS NULL
    AND draft_revision > 0 AND draft_snapshot_sha256 ~ '^[a-f0-9]{64}$')
);
COMMIT;
