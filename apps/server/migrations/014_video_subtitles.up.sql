-- Private, optional subtitle history. No published manifest or catalog wire change.
ALTER TABLE private_objects DROP CONSTRAINT private_objects_content_type;
ALTER TABLE private_objects ADD CONSTRAINT private_objects_content_type CHECK (content_type IN ('image/png', 'image/jpeg', 'application/pdf', 'video/mp4', 'audio/mpeg', 'text/vtt'));

CREATE TABLE video_subtitle_tracks (
  id text PRIMARY KEY CHECK (id ~ '^st_[a-f0-9]{32}$'),
  creator_account_id text NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  item_id text NOT NULL,
  video_asset_id text NOT NULL,
  object_id text NOT NULL,
  language text NOT NULL CHECK (length(language) BETWEEN 2 AND 35),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 262144),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  version integer NOT NULL CHECK (version >= 1),
  state text NOT NULL CHECK (state IN ('active', 'replaced', 'removed')),
  replaced_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (item_id, project_id, creator_account_id) REFERENCES catalog_items(id, project_id, creator_account_id),
  FOREIGN KEY (video_asset_id) REFERENCES catalog_media_assets(id),
  FOREIGN KEY (object_id, project_id, creator_account_id) REFERENCES private_objects(id, project_id, creator_account_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX video_subtitle_active_language ON video_subtitle_tracks(creator_account_id, project_id, item_id, video_asset_id, language) WHERE state = 'active';
CREATE INDEX video_subtitle_parent ON video_subtitle_tracks(creator_account_id, project_id, item_id, video_asset_id);
