-- A reviewed approval is bound to one deployment and one exact project/catalog
-- revision. Releases contain only the validated public wire bytes.
ALTER TABLE channel_deployments ADD CONSTRAINT channel_deployments_publication_scope
  UNIQUE (id, project_id, creator_account_id);
CREATE TABLE publication_approvals (
  id text PRIMARY KEY CHECK (id ~ '^ap_[a-f0-9]{32}$'),
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  deployment_id text NOT NULL,
  channel_revision integer NOT NULL CHECK (channel_revision > 0),
  catalog_revision integer NOT NULL CHECK (catalog_revision > 0),
  expected_live_release_id text,
  rollback_source_release_id text,
  channel_snapshot jsonb NOT NULL,
  bindings jsonb NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, creator_account_id, project_id, deployment_id),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE,
  FOREIGN KEY (deployment_id, project_id, creator_account_id)
    REFERENCES channel_deployments(id, project_id, creator_account_id) ON DELETE CASCADE,
  CHECK (jsonb_typeof(channel_snapshot) = 'object' AND jsonb_typeof(bindings) = 'object'),
  CHECK (channel_snapshot->>'id' = project_id)
);
CREATE INDEX publication_approvals_scope_idx ON publication_approvals(creator_account_id, project_id, deployment_id, approved_at);

CREATE TABLE publication_releases (
  id text PRIMARY KEY CHECK (id ~ '^rel_[a-f0-9]{32}$'),
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  deployment_id text NOT NULL,
  approval_id text NOT NULL UNIQUE,
  sequence integer NOT NULL CHECK (sequence > 0),
  previous_release_id text,
  rollback_source_release_id text,
  manifest_bytes text NOT NULL CHECK (octet_length(manifest_bytes) BETWEEN 1 AND 1048576),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz NOT NULL,
  UNIQUE (deployment_id, sequence),
  UNIQUE (id, deployment_id),
  UNIQUE (id, creator_account_id, project_id, deployment_id),
  FOREIGN KEY (approval_id, creator_account_id, project_id, deployment_id)
    REFERENCES publication_approvals(id, creator_account_id, project_id, deployment_id) ON DELETE CASCADE,
  FOREIGN KEY (previous_release_id, deployment_id) REFERENCES publication_releases(id, deployment_id),
  FOREIGN KEY (rollback_source_release_id, deployment_id) REFERENCES publication_releases(id, deployment_id),
  CHECK ((sequence = 1 AND previous_release_id IS NULL) OR (sequence > 1 AND previous_release_id IS NOT NULL))
);
ALTER TABLE publication_approvals ADD CONSTRAINT publication_rollback_source_scope
  FOREIGN KEY (rollback_source_release_id, deployment_id) REFERENCES publication_releases(id, deployment_id);

CREATE TABLE publication_live_pointers (
  deployment_id text PRIMARY KEY,
  creator_account_id text NOT NULL,
  project_id text NOT NULL,
  release_id text NOT NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  activated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (deployment_id, project_id, creator_account_id)
    REFERENCES channel_deployments(id, project_id, creator_account_id) ON DELETE CASCADE,
  FOREIGN KEY (release_id, creator_account_id, project_id, deployment_id)
    REFERENCES publication_releases(id, creator_account_id, project_id, deployment_id)
);

CREATE TABLE publication_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creator_account_id text NOT NULL REFERENCES creator_accounts(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  deployment_id text NOT NULL,
  approval_id text NOT NULL,
  release_id text,
  action text NOT NULL CHECK (action IN ('approved', 'published', 'rollback_approved', 'rollback_published')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, creator_account_id) REFERENCES channel_ownerships(project_id, creator_account_id) ON DELETE CASCADE
);

CREATE FUNCTION firelaunch_publication_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Publication history is immutable';
END $$;
CREATE FUNCTION firelaunch_release_lineage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE predecessor_sequence integer;
BEGIN
  IF NEW.sequence > 1 THEN
    SELECT sequence INTO predecessor_sequence FROM publication_releases
      WHERE id = NEW.previous_release_id AND deployment_id = NEW.deployment_id;
    IF predecessor_sequence IS DISTINCT FROM NEW.sequence - 1 THEN
      RAISE EXCEPTION 'Publication release lineage is not monotonic';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_release_lineage BEFORE INSERT ON publication_releases
  FOR EACH ROW EXECUTE FUNCTION firelaunch_release_lineage();
CREATE FUNCTION firelaunch_live_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE released_sequence integer;
DECLARE predecessor text;
BEGIN
  SELECT sequence, previous_release_id INTO released_sequence, predecessor FROM publication_releases
    WHERE id = NEW.release_id AND deployment_id = NEW.deployment_id;
  IF released_sequence IS DISTINCT FROM NEW.sequence OR
    (TG_OP = 'INSERT' AND (NEW.sequence <> 1 OR predecessor IS NOT NULL)) OR
    (TG_OP = 'UPDATE' AND (NEW.sequence <> OLD.sequence + 1 OR predecessor IS DISTINCT FROM OLD.release_id)) THEN
    RAISE EXCEPTION 'Publication live pointer must advance to its next release';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_live_sequence BEFORE INSERT OR UPDATE ON publication_live_pointers
  FOR EACH ROW EXECUTE FUNCTION firelaunch_live_sequence();
CREATE TRIGGER publication_approval_no_update BEFORE UPDATE ON publication_approvals
  FOR EACH ROW EXECUTE FUNCTION firelaunch_publication_immutable();
CREATE TRIGGER publication_release_no_update BEFORE UPDATE ON publication_releases
  FOR EACH ROW EXECUTE FUNCTION firelaunch_publication_immutable();
CREATE FUNCTION firelaunch_publication_no_direct_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Cascading account/project erasure remains possible. Direct history deletion while
  -- its project exists would silently rewrite the creator's publication record.
  IF EXISTS (SELECT 1 FROM channel_projects WHERE id = OLD.project_id) THEN
    RAISE EXCEPTION 'Publication history is immutable';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER publication_approval_no_delete BEFORE DELETE ON publication_approvals
  FOR EACH ROW EXECUTE FUNCTION firelaunch_publication_no_direct_delete();
CREATE TRIGGER publication_release_no_delete BEFORE DELETE ON publication_releases
  FOR EACH ROW EXECUTE FUNCTION firelaunch_publication_no_direct_delete();
