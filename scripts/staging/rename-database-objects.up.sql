-- Run with ON_ERROR_STOP against a verified schema-15 database while the API and
-- worker are stopped. No rows, IDs, grants, trigger bindings or indexes are rebuilt.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.firelaunch_schema_migrations') IS NULL
     OR to_regclass('public.vegalaunch_schema_migrations') IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'firelaunch_build')
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vegalaunch_build')
     OR (SELECT max(version) FROM public.firelaunch_schema_migrations) <> 15 THEN
    RAISE EXCEPTION 'Unexpected database identity or schema version';
  END IF;
END $$;
ALTER TABLE public.firelaunch_schema_migrations RENAME TO vegalaunch_schema_migrations;
ALTER TABLE public.vegalaunch_schema_migrations RENAME CONSTRAINT firelaunch_schema_migrations_pkey TO vegalaunch_schema_migrations_pkey;
ALTER SCHEMA firelaunch_build RENAME TO vegalaunch_build;
ALTER FUNCTION public.firelaunch_live_sequence() RENAME TO vegalaunch_live_sequence;
ALTER FUNCTION public.firelaunch_managed_job_identity_immutable() RENAME TO vegalaunch_managed_job_identity_immutable;
ALTER FUNCTION public.firelaunch_publication_immutable() RENAME TO vegalaunch_publication_immutable;
ALTER FUNCTION public.firelaunch_publication_no_direct_delete() RENAME TO vegalaunch_publication_no_direct_delete;
ALTER FUNCTION public.firelaunch_release_lineage() RENAME TO vegalaunch_release_lineage;
ALTER FUNCTION public.firelaunch_rendition_immutable() RENAME TO vegalaunch_rendition_immutable;
COMMIT;
