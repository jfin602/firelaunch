-- Private, owner-bound media control plane. Catalog rewrites delete/reinsert their
-- JSON rows within one transaction, so asset references are checked at commit.
ALTER TABLE catalog_media_assets ADD CONSTRAINT catalog_media_assets_pipeline_scope UNIQUE (id, item_id, project_id, creator_account_id);

CREATE TABLE media_asset_lifecycle (
  asset_id text PRIMARY KEY,
  item_id text NOT NULL,
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (asset_id, item_id, project_id, creator_account_id)
    REFERENCES catalog_media_assets(id, item_id, project_id, creator_account_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE media_upload_sessions (
  id text PRIMARY KEY CHECK (id ~ '^up_[a-f0-9]{32}$'),
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  item_id text NOT NULL,
  asset_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{16,128}$'),
  state text NOT NULL DEFAULT 'initiated' CHECK (state IN ('initiated','verified','aborted','expired')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  original_key text NOT NULL UNIQUE CHECK (original_key ~ '^media/[a-f0-9]{32}/[a-f0-9]{32}/[a-f0-9]{32}/[a-z0-9/_-]+(\.[a-z0-9]+)?$'),
  expected_bytes bigint NOT NULL CHECK (expected_bytes BETWEEN 1 AND 50000000000),
  expected_sha256 text NOT NULL CHECK (expected_sha256 ~ '^[a-f0-9]{64}$'),
  verified_bytes bigint,
  verified_sha256 text,
  content_type text NOT NULL CHECK (content_type = 'video/mp4'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_account_id, project_id, asset_id, idempotency_key),
  UNIQUE (id, asset_id, item_id, project_id, creator_account_id),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id, item_id, project_id, creator_account_id)
    REFERENCES catalog_media_assets(id, item_id, project_id, creator_account_id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((state = 'verified' AND verified_bytes IS NOT NULL AND verified_sha256 IS NOT NULL
    AND verified_bytes = expected_bytes AND verified_sha256 = expected_sha256)
    OR (state <> 'verified' AND verified_bytes IS NULL AND verified_sha256 IS NULL)),
  CHECK (original_key LIKE 'media/' || substring(creator_account_id from 4) || '/' ||
    substring(project_id from 4) || '/' || substring(asset_id from 4) || '/%')
);
CREATE INDEX media_upload_expiry_idx ON media_upload_sessions(expires_at) WHERE state = 'initiated';
CREATE INDEX media_upload_scope_idx ON media_upload_sessions(creator_account_id, project_id, asset_id, created_at);

CREATE TABLE media_processing_jobs (
  id text PRIMARY KEY CHECK (id ~ '^job_[a-f0-9]{32}$'),
  upload_session_id text NOT NULL UNIQUE,
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  item_id text NOT NULL,
  asset_id text NOT NULL,
  profile text NOT NULL CHECK (profile = 'hls-avc-aac-v1'),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','ready','failed','revoked')),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  lease_token uuid,
  lease_until timestamptz,
  failure_code text CHECK (failure_code IN ('probe_failed','encode_failed','verification_failed','worker_timeout')),
  rendition_set_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, asset_id, item_id, project_id, creator_account_id),
  FOREIGN KEY (upload_session_id, asset_id, item_id, project_id, creator_account_id)
    REFERENCES media_upload_sessions(id, asset_id, item_id, project_id, creator_account_id) ON DELETE RESTRICT,
  CHECK ((state = 'leased') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK (state = 'leased' OR (lease_token IS NULL AND lease_until IS NULL)),
  CHECK ((state = 'failed') = (failure_code IS NOT NULL)),
  CHECK ((state = 'ready') = (rendition_set_id IS NOT NULL))
);
CREATE INDEX media_jobs_pending_idx ON media_processing_jobs(created_at, id) WHERE state = 'pending';
CREATE INDEX media_jobs_lease_idx ON media_processing_jobs(lease_until) WHERE state = 'leased';
CREATE INDEX media_jobs_scope_idx ON media_processing_jobs(creator_account_id, project_id, asset_id);

CREATE TABLE media_rendition_sets (
  id text PRIMARY KEY CHECK (id ~ '^rs_[a-f0-9]{32}$'),
  job_id text NOT NULL UNIQUE,
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  item_id text NOT NULL,
  asset_id text NOT NULL,
  profile text NOT NULL CHECK (profile = 'hls-avc-aac-v1'),
  master_key text NOT NULL UNIQUE CHECK (master_key ~ '^media/[a-f0-9]{32}/[a-f0-9]{32}/[a-f0-9]{32}/[a-z0-9/_-]+\.m3u8$'),
  master_sha256 text NOT NULL CHECK (master_sha256 ~ '^[a-f0-9]{64}$'),
  variants jsonb NOT NULL CHECK (jsonb_typeof(variants) = 'array' AND jsonb_array_length(variants) BETWEEN 1 AND 3),
  verified_at timestamptz NOT NULL,
  revoked_at timestamptz,
  FOREIGN KEY (job_id, asset_id, item_id, project_id, creator_account_id)
    REFERENCES media_processing_jobs(id, asset_id, item_id, project_id, creator_account_id) ON DELETE RESTRICT,
  CHECK (master_key LIKE 'media/' || substring(creator_account_id from 4) || '/' ||
    substring(project_id from 4) || '/' || substring(asset_id from 4) || '/%')
);
ALTER TABLE media_processing_jobs ADD CONSTRAINT media_jobs_rendition_owned
  FOREIGN KEY (rendition_set_id) REFERENCES media_rendition_sets(id) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION vegalaunch_rendition_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.job_id IS DISTINCT FROM OLD.job_id OR
     NEW.creator_account_id IS DISTINCT FROM OLD.creator_account_id OR NEW.project_id IS DISTINCT FROM OLD.project_id OR
     NEW.item_id IS DISTINCT FROM OLD.item_id OR NEW.asset_id IS DISTINCT FROM OLD.asset_id OR
     NEW.profile IS DISTINCT FROM OLD.profile OR NEW.master_key IS DISTINCT FROM OLD.master_key OR
     NEW.master_sha256 IS DISTINCT FROM OLD.master_sha256 OR NEW.variants IS DISTINCT FROM OLD.variants OR
     NEW.verified_at IS DISTINCT FROM OLD.verified_at OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Verified renditions are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER media_rendition_immutable BEFORE UPDATE ON media_rendition_sets
  FOR EACH ROW EXECUTE FUNCTION vegalaunch_rendition_immutable();
