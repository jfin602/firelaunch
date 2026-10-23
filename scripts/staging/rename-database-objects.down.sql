-- Restore names for the pre-cutover binary. Run only while API and worker are stopped.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.vegalaunch_schema_migrations') IS NULL
     OR to_regclass('public.firelaunch_schema_migrations') IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vegalaunch_build')
     OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'firelaunch_build')
     OR (SELECT max(version) FROM public.vegalaunch_schema_migrations) <> 15 THEN
    RAISE EXCEPTION 'Unexpected database identity or schema version';
  END IF;
END $$;
ALTER FUNCTION public.vegalaunch_live_sequence() RENAME TO firelaunch_live_sequence;
ALTER FUNCTION public.vegalaunch_managed_job_identity_immutable() RENAME TO firelaunch_managed_job_identity_immutable;
ALTER FUNCTION public.vegalaunch_publication_immutable() RENAME TO firelaunch_publication_immutable;
ALTER FUNCTION public.vegalaunch_publication_no_direct_delete() RENAME TO firelaunch_publication_no_direct_delete;
ALTER FUNCTION public.vegalaunch_release_lineage() RENAME TO firelaunch_release_lineage;
ALTER FUNCTION public.vegalaunch_rendition_immutable() RENAME TO firelaunch_rendition_immutable;
ALTER SCHEMA vegalaunch_build RENAME TO firelaunch_build;
ALTER TABLE public.vegalaunch_schema_migrations RENAME CONSTRAINT vegalaunch_schema_migrations_pkey TO firelaunch_schema_migrations_pkey;
ALTER TABLE public.vegalaunch_schema_migrations RENAME TO firelaunch_schema_migrations;
COMMIT;
