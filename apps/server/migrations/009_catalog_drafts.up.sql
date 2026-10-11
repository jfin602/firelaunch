CREATE TABLE catalog_draft_baselines (
  project_id text PRIMARY KEY,
  creator_account_id text NOT NULL,
  creator_type text NOT NULL CHECK (creator_type IN ('video', 'audio', 'writing')),
  baseline jsonb NOT NULL,
  selection jsonb NOT NULL,
  FOREIGN KEY (project_id, creator_account_id) REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE
);
