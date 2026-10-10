CREATE TABLE private_object_garbage (
  object_key text PRIMARY KEY CHECK (object_key ~ '^private/[a-f0-9]{64}$'),
  queued_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE operational_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type ~ '^[a-z_]{3,64}$'),
  outcome text NOT NULL CHECK (outcome IN ('started', 'success', 'denied', 'failure')),
  actor_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
