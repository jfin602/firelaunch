ALTER TABLE private_objects
  ADD COLUMN content_type text NOT NULL DEFAULT 'application/octet-stream',
  ADD COLUMN byte_size integer NOT NULL DEFAULT 0 CHECK (byte_size BETWEEN 0 AND 1048576),
  ADD COLUMN sha256 text NOT NULL DEFAULT repeat('0', 64) CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE private_objects ADD CONSTRAINT private_objects_id_format CHECK (id ~ '^(ma|ev)_[a-f0-9]{32}$');
ALTER TABLE private_objects ADD CONSTRAINT private_objects_key_format CHECK (object_key ~ '^private/[a-f0-9]{64}$');
ALTER TABLE private_objects ADD CONSTRAINT private_objects_content_type CHECK (content_type IN ('image/png', 'image/jpeg', 'application/pdf', 'video/mp4', 'audio/mpeg'));
CREATE INDEX private_objects_owner_idx ON private_objects(creator_account_id, project_id);

CREATE TABLE private_object_capabilities (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  object_id text NOT NULL REFERENCES private_objects(id) ON DELETE CASCADE,
  creator_account_id text NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose = 'download'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX private_object_capabilities_object_idx ON private_object_capabilities(object_id);
