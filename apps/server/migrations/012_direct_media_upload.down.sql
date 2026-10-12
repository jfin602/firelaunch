ALTER TABLE media_upload_sessions
  DROP CONSTRAINT media_upload_parts_safe,
  DROP CONSTRAINT media_upload_duration_safe,
  DROP CONSTRAINT media_upload_s3_id_safe,
  DROP COLUMN part_count,
  DROP COLUMN part_size,
  DROP COLUMN claimed_duration_seconds,
  DROP COLUMN s3_upload_id;
ALTER TABLE media_upload_sessions DROP CONSTRAINT media_upload_sessions_state_check;
ALTER TABLE media_upload_sessions ADD CONSTRAINT media_upload_sessions_state_check
  CHECK (state IN ('initiated','verified','aborted','expired'));
