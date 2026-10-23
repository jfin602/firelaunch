-- Optional build queue. Apply separately; never insert into vegalaunch_schema_migrations.
-- The operator creates dedicated NOLOGIN owner, LOGIN API and LOGIN worker roles first.
BEGIN;
CREATE SCHEMA IF NOT EXISTS vegalaunch_build;
CREATE TABLE IF NOT EXISTS vegalaunch_build.jobs (
  id text PRIMARY KEY CHECK (id ~ '^job_[a-f0-9]{32}$'),
  creator_account_id text NOT NULL CHECK (creator_account_id ~ '^cr_[a-f0-9]{32}$'),
  project_id text NOT NULL CHECK (project_id ~ '^ch_[a-f0-9]{32}$'),
  deployment_id text NOT NULL CHECK (deployment_id ~ '^dep_[a-f0-9]{32}$'),
  package_id text NOT NULL CHECK (length(package_id) BETWEEN 3 AND 240),
  release_id text NOT NULL CHECK (release_id ~ '^rel_[a-f0-9]{32}$'),
  release_sequence integer NOT NULL CHECK (release_sequence > 0),
  input_fingerprint text NOT NULL CHECK (input_fingerprint ~ '^[a-f0-9]{64}$'),
  source_hash text NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
  -- P7 fingerprints depend on JSON property order. Preserve the exact serialized snapshot.
  input text NOT NULL CHECK (octet_length(input) BETWEEN 2 AND 20000000 AND jsonb_typeof(input::jsonb) = 'object'),
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','ready','failed','canceled','expired')),
  attempt smallint NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 3),
  lease_token text CHECK (lease_token ~ '^[a-f0-9]{64}$'),
  lease_until timestamptz,
  heartbeat_at timestamptz,
  error_code text CHECK (error_code ~ '^[A-Z_]{3,40}$'),
  artifact_name text CHECK (artifact_name ~ '^job_[a-f0-9]{32}\.vpkg$'),
  artifact_sha256 text CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_bytes bigint CHECK (artifact_bytes BETWEEN 1024 AND 500000000),
  evidence jsonb CHECK (evidence IS NULL OR jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CHECK ((state = 'running') = (lease_token IS NOT NULL AND lease_until IS NOT NULL)),
  CHECK (state <> 'ready' OR (artifact_name IS NOT NULL AND artifact_sha256 IS NOT NULL AND artifact_bytes IS NOT NULL AND evidence IS NOT NULL)),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS build_jobs_single_running ON vegalaunch_build.jobs ((true)) WHERE state = 'running';
CREATE UNIQUE INDEX IF NOT EXISTS build_jobs_one_active_project ON vegalaunch_build.jobs (creator_account_id, project_id)
  WHERE state IN ('queued','running','ready');
CREATE INDEX IF NOT EXISTS build_jobs_claim ON vegalaunch_build.jobs (created_at, id) WHERE state = 'queued';
CREATE INDEX IF NOT EXISTS build_jobs_expiry ON vegalaunch_build.jobs (expires_at);
COMMIT;
