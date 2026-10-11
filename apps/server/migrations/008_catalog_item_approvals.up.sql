-- Approval is separate from selection for a channel and from media-use rights.
-- Existing items are deliberately not backfilled: their review origin cannot be proven.
CREATE TABLE catalog_item_approvals (
  item_id text PRIMARY KEY CHECK (item_id ~ '^ci_[a-f0-9]{32}$'),
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('import_approved', 'creator_entry')),
  approved_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE
);
CREATE INDEX catalog_item_approvals_owner_idx ON catalog_item_approvals(project_id, creator_account_id);
