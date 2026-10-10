ALTER TABLE private_objects ADD CONSTRAINT private_objects_kind_matches_id CHECK (
  (kind = 'media' AND id ~ '^ma_[a-f0-9]{32}$') OR
  (kind = 'evidence' AND id ~ '^ev_[a-f0-9]{32}$')
);

ALTER TABLE catalog_media_assets
  ADD COLUMN display_evidence_id text GENERATED ALWAYS AS (record#>>'{tvDisplayRights,evidenceId}') STORED,
  ADD COLUMN playback_evidence_id text GENERATED ALWAYS AS (record#>>'{tvPlaybackRights,evidenceId}') STORED,
  ADD COLUMN private_object_id text GENERATED ALWAYS AS (CASE WHEN record#>>'{location,type}' = 'private_object' THEN record#>>'{location,objectId}' END) STORED;
ALTER TABLE catalog_media_assets
  ADD CONSTRAINT catalog_media_display_evidence_owned FOREIGN KEY (display_evidence_id, project_id, creator_account_id) REFERENCES private_objects(id, project_id, creator_account_id),
  ADD CONSTRAINT catalog_media_playback_evidence_owned FOREIGN KEY (playback_evidence_id, project_id, creator_account_id) REFERENCES private_objects(id, project_id, creator_account_id),
  ADD CONSTRAINT catalog_media_private_object_owned FOREIGN KEY (private_object_id, project_id, creator_account_id) REFERENCES private_objects(id, project_id, creator_account_id),
  ADD CONSTRAINT catalog_media_display_evidence_format CHECK (display_evidence_id IS NULL OR display_evidence_id ~ '^ev_[a-f0-9]{32}$'),
  ADD CONSTRAINT catalog_media_playback_evidence_format CHECK (playback_evidence_id IS NULL OR playback_evidence_id ~ '^ev_[a-f0-9]{32}$'),
  ADD CONSTRAINT catalog_media_private_object_format CHECK (private_object_id IS NULL OR private_object_id ~ '^ma_[a-f0-9]{32}$');

CREATE TABLE catalog_media_rights_events (
  id uuid PRIMARY KEY,
  project_id text NOT NULL,
  creator_account_id text NOT NULL,
  asset_id text NOT NULL CHECK (asset_id ~ '^ma_[a-f0-9]{32}$'),
  assertion jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE,
  CHECK (jsonb_typeof(assertion) = 'object')
);
CREATE INDEX catalog_media_rights_events_owner_idx ON catalog_media_rights_events(project_id, creator_account_id, asset_id, recorded_at);
