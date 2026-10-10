CREATE TABLE hosted_source_projects (
  project_id text PRIMARY KEY,
  creator_account_id text NOT NULL,
  spec_revision integer NOT NULL CHECK (spec_revision > 0),
  fingerprint text NOT NULL,
  files jsonb NOT NULL,
  baseline jsonb NOT NULL,
  FOREIGN KEY (project_id, creator_account_id)
    REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE,
  CHECK (jsonb_typeof(files) = 'object' AND jsonb_typeof(baseline) = 'object')
);
