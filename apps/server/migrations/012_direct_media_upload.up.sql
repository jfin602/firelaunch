ALTER TABLE media_upload_sessions
  DROP CONSTRAINT media_upload_sessions_state_check;
ALTER TABLE media_upload_sessions
  ADD CONSTRAINT media_upload_sessions_state_check
    CHECK (state IN ('initiated','completed','verified','aborting','expiring','aborted','expired'));
ALTER TABLE media_upload_sessions
  ADD COLUMN s3_upload_id text,
  ADD COLUMN claimed_duration_seconds integer,
  ADD COLUMN part_size integer,
  ADD COLUMN part_count integer,
  ADD CONSTRAINT media_upload_s3_id_safe CHECK (s3_upload_id IS NULL OR (length(s3_upload_id) BETWEEN 1 AND 512)),
  ADD CONSTRAINT media_upload_duration_safe CHECK (claimed_duration_seconds IS NULL OR claimed_duration_seconds BETWEEN 1 AND 14400),
  ADD CONSTRAINT media_upload_parts_safe CHECK ((part_size IS NULL AND part_count IS NULL) OR
    (part_size BETWEEN 5242880 AND 1073741824 AND part_count BETWEEN 1 AND 1000));
