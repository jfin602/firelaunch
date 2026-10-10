ALTER TABLE private_objects ADD CONSTRAINT private_objects_owned_id UNIQUE (id, project_id, creator_account_id);

CREATE TABLE catalog_revisions (
  project_id text PRIMARY KEY,
  creator_account_id text NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  UNIQUE (project_id, creator_account_id),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE
);

CREATE TABLE catalog_sources (
  id text PRIMARY KEY CHECK (id ~ '^src_[a-f0-9]{32}$'),
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  record jsonb NOT NULL,
  evidence_id text GENERATED ALWAYS AS (record#>>'{permission,verificationEvidenceId}') STORED,
  UNIQUE (id, project_id, creator_account_id),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES catalog_revisions(project_id, creator_account_id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id, project_id, creator_account_id) REFERENCES private_objects(id, project_id, creator_account_id),
  CHECK (evidence_id IS NULL OR evidence_id ~ '^ev_[a-f0-9]{32}$'),
  CHECK (record->>'id' = id AND record->>'projectId' = project_id AND record->>'creatorAccountId' = creator_account_id AND record->>'schemaVersion' = '1')
);
CREATE UNIQUE INDEX catalog_source_external_identity_unique ON catalog_sources (
  creator_account_id, project_id,
  (record#>>'{externalIdentity,provider}'),
  COALESCE(record#>>'{externalIdentity,marketplace}', ''),
  (record#>>'{externalIdentity,kind}'),
  (record#>>'{externalIdentity,value}')
) WHERE record ? 'externalIdentity';

CREATE TABLE catalog_items (
  id text PRIMARY KEY CHECK (id ~ '^ci_[a-f0-9]{32}$'),
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  source_id text NOT NULL,
  record jsonb NOT NULL,
  UNIQUE (id, project_id, creator_account_id),
  FOREIGN KEY (source_id, project_id, creator_account_id) REFERENCES catalog_sources(id, project_id, creator_account_id),
  CHECK (record->>'id' = id AND record->>'projectId' = project_id AND record->>'creatorAccountId' = creator_account_id AND record->>'schemaVersion' = '1' AND record#>>'{sourceRecord,sourceId}' = source_id)
);

CREATE TABLE catalog_item_identifiers (
  source_id text NOT NULL,
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  item_id text NOT NULL,
  provider text NOT NULL,
  marketplace text NOT NULL DEFAULT '',
  kind text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (source_id, provider, marketplace, kind, value),
  FOREIGN KEY (source_id, project_id, creator_account_id) REFERENCES catalog_sources(id, project_id, creator_account_id),
  FOREIGN KEY (item_id, project_id, creator_account_id) REFERENCES catalog_items(id, project_id, creator_account_id) ON DELETE CASCADE
);

CREATE TABLE catalog_media_assets (
  id text PRIMARY KEY CHECK (id ~ '^ma_[a-f0-9]{32}$'),
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  item_id text NOT NULL,
  record jsonb NOT NULL,
  evidence_id text GENERATED ALWAYS AS (record#>>'{rights,evidenceId}') STORED,
  FOREIGN KEY (item_id, project_id, creator_account_id) REFERENCES catalog_items(id, project_id, creator_account_id),
  FOREIGN KEY (evidence_id, project_id, creator_account_id) REFERENCES private_objects(id, project_id, creator_account_id),
  CHECK (evidence_id IS NULL OR evidence_id ~ '^ev_[a-f0-9]{32}$'),
  CHECK (record->>'id' = id AND record->>'projectId' = project_id AND record->>'creatorAccountId' = creator_account_id AND record->>'catalogItemId' = item_id AND record->>'schemaVersion' = '1')
);

CREATE TABLE catalog_collections (
  id text PRIMARY KEY CHECK (id ~ '^col_[a-f0-9]{32}$'),
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  record jsonb NOT NULL,
  UNIQUE (id, project_id, creator_account_id),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES catalog_revisions(project_id, creator_account_id) ON DELETE CASCADE,
  CHECK (record->>'id' = id AND record->>'projectId' = project_id AND record->>'creatorAccountId' = creator_account_id AND record->>'schemaVersion' = '1')
);

CREATE TABLE catalog_collection_items (
  collection_id text NOT NULL,
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  item_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (collection_id, item_id),
  UNIQUE (collection_id, position),
  FOREIGN KEY (collection_id, project_id, creator_account_id) REFERENCES catalog_collections(id, project_id, creator_account_id) ON DELETE CASCADE,
  FOREIGN KEY (item_id, project_id, creator_account_id) REFERENCES catalog_items(id, project_id, creator_account_id)
);
