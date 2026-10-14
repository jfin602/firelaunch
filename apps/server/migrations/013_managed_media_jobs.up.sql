-- Additive managed-provider correlation. Existing FFmpeg jobs and READY renditions stay intact.
CREATE TABLE managed_media_job_attempts (
  intent_token uuid PRIMARY KEY,
  processing_job_id text NOT NULL,
  upload_session_id text NOT NULL,
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  item_id text NOT NULL,
  asset_id text NOT NULL,
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 3),
  profile_hash text NOT NULL CHECK (profile_hash ~ '^[a-f0-9]{64}$'),
  original_key text NOT NULL,
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[a-f0-9]{64}$'),
  original_bytes bigint NOT NULL CHECK (original_bytes BETWEEN 1 AND 50000000000),
  output_staging_prefix text NOT NULL UNIQUE,
  aws_account_id text NOT NULL CHECK (aws_account_id ~ '^[0-9]{12}$'),
  aws_region text NOT NULL CHECK (aws_region ~ '^[a-z]{2}(-gov)?-[a-z]+-[1-9][0-9]?$'),
  aws_job_id text CHECK (aws_job_id IS NULL OR aws_job_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  state text NOT NULL DEFAULT 'intent' CHECK (state IN ('intent','submitted','progressing','complete','error','canceled')),
  observed_status text CHECK (observed_status IS NULL OR observed_status IN ('SUBMITTED','PROGRESSING','COMPLETE','ERROR','CANCELED')),
  observed_error_code text CHECK (observed_error_code IS NULL OR observed_error_code ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  reconcile_after timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  cancel_requested_at timestamptz,
  cancel_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processing_job_id, attempt),
  UNIQUE (processing_job_id, intent_token),
  FOREIGN KEY (processing_job_id, asset_id, item_id, project_id, creator_account_id)
    REFERENCES media_processing_jobs(id, asset_id, item_id, project_id, creator_account_id) ON DELETE RESTRICT,
  FOREIGN KEY (upload_session_id, asset_id, item_id, project_id, creator_account_id)
    REFERENCES media_upload_sessions(id, asset_id, item_id, project_id, creator_account_id) ON DELETE RESTRICT,
  CHECK (output_staging_prefix LIKE 'media/' || substring(creator_account_id from 4) || '/' ||
    substring(project_id from 4) || '/' || substring(asset_id from 4) || '/staged/' ||
    replace(intent_token::text, '-', '') || '/'),
  CHECK (output_staging_prefix ~ '^media/[a-f0-9]{32}/[a-f0-9]{32}/[a-f0-9]{32}/staged/[a-f0-9]{32}/$'),
  CHECK (original_key LIKE 'media/' || substring(creator_account_id from 4) || '/' ||
    substring(project_id from 4) || '/' || substring(asset_id from 4) || '/original/%'),
  CHECK ((state = 'intent') = (aws_job_id IS NULL)),
  CHECK (COALESCE(observed_status = 'ERROR', false) = (observed_error_code IS NOT NULL)),
  CHECK ((state = 'intent' AND observed_status IS NULL) OR
    (state = 'submitted' AND observed_status = 'SUBMITTED') OR
    (state = 'progressing' AND observed_status = 'PROGRESSING') OR
    (state = 'complete' AND observed_status = 'COMPLETE') OR
    (state = 'error' AND observed_status = 'ERROR') OR
    (state = 'canceled' AND observed_status = 'CANCELED'))
);
CREATE UNIQUE INDEX managed_media_aws_job_identity ON managed_media_job_attempts
  (aws_account_id, aws_region, aws_job_id) WHERE aws_job_id IS NOT NULL;
CREATE INDEX managed_media_reconcile_due ON managed_media_job_attempts(reconcile_after, intent_token)
  WHERE state IN ('intent','submitted','progressing','complete');

CREATE FUNCTION firelaunch_managed_job_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.intent_token IS DISTINCT FROM OLD.intent_token OR
     NEW.processing_job_id IS DISTINCT FROM OLD.processing_job_id OR
     NEW.upload_session_id IS DISTINCT FROM OLD.upload_session_id OR
     NEW.creator_account_id IS DISTINCT FROM OLD.creator_account_id OR
     NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.item_id IS DISTINCT FROM OLD.item_id OR
     NEW.asset_id IS DISTINCT FROM OLD.asset_id OR NEW.attempt IS DISTINCT FROM OLD.attempt OR
     NEW.profile_hash IS DISTINCT FROM OLD.profile_hash OR NEW.original_key IS DISTINCT FROM OLD.original_key OR
     NEW.original_sha256 IS DISTINCT FROM OLD.original_sha256 OR NEW.original_bytes IS DISTINCT FROM OLD.original_bytes OR
     NEW.output_staging_prefix IS DISTINCT FROM OLD.output_staging_prefix OR
     NEW.aws_account_id IS DISTINCT FROM OLD.aws_account_id OR NEW.aws_region IS DISTINCT FROM OLD.aws_region OR
     (OLD.aws_job_id IS NOT NULL AND NEW.aws_job_id IS DISTINCT FROM OLD.aws_job_id) THEN
    RAISE EXCEPTION 'Managed job identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER managed_media_job_identity_immutable BEFORE UPDATE ON managed_media_job_attempts
  FOR EACH ROW EXECUTE FUNCTION firelaunch_managed_job_identity_immutable();
