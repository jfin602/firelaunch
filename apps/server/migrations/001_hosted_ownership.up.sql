CREATE TABLE creator_accounts (
  id text PRIMARY KEY CHECK (id ~ '^cr_[a-f0-9]{32}$'),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_identities (
  issuer text NOT NULL,
  subject text NOT NULL,
  creator_account_id text NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (issuer, subject),
  UNIQUE (creator_account_id, issuer, subject)
);

CREATE TABLE channel_projects (
  id text PRIMARY KEY CHECK (id ~ '^ch_[a-f0-9]{32}$'),
  creator_account_id text NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  spec jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (id, creator_account_id),
  CHECK (jsonb_typeof(spec) = 'object' AND spec->>'id' = id AND spec->>'schemaVersion' = '1')
);

CREATE TABLE channel_ownerships (
  project_id text PRIMARY KEY,
  creator_account_id text NOT NULL,
  channel_id text NOT NULL CHECK (channel_id = project_id),
  UNIQUE (project_id, creator_account_id),
  FOREIGN KEY (project_id, creator_account_id)
    REFERENCES channel_projects(id, creator_account_id) ON DELETE CASCADE
);

CREATE TABLE channel_deployments (
  id text PRIMARY KEY CHECK (id ~ '^dep_[a-f0-9]{32}$'),
  creator_account_id text NOT NULL,
  project_id text NOT NULL UNIQUE,
  channel_id text NOT NULL CHECK (channel_id = project_id),
  package_id text NOT NULL UNIQUE,
  deployment jsonb NOT NULL,
  FOREIGN KEY (project_id, creator_account_id)
    REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE,
  CHECK (deployment->>'id' = id AND deployment->>'packageId' = package_id)
);

CREATE TABLE private_objects (
  id text PRIMARY KEY,
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('media', 'evidence')),
  object_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY (project_id, creator_account_id)
    REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE
);

CREATE TABLE legacy_import_markers (
  creator_account_id text NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  legacy_project_id text NOT NULL,
  fingerprint text NOT NULL,
  imported_project_id text NOT NULL,
  PRIMARY KEY (creator_account_id, legacy_project_id),
  FOREIGN KEY (imported_project_id, creator_account_id)
    REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE
);

CREATE TABLE creator_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creator_account_id text NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  project_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
