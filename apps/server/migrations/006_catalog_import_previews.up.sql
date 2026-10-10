CREATE TABLE catalog_import_previews (
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  source_id text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 0),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, creator_account_id, source_id, revision, fingerprint),
  FOREIGN KEY (source_id, project_id, creator_account_id) REFERENCES catalog_sources(id, project_id, creator_account_id) ON DELETE CASCADE
);
