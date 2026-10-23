-- One-time rename of the clean, private qualification project's generated
-- manifest filename. Preserve the bound package identity and media URLs.
-- Run with psql -v ON_ERROR_STOP=1 against the schema-15 staging database.
BEGIN;
DO $$
DECLARE
  changed integer;
BEGIN
  UPDATE hosted_source_projects
  SET files = jsonb_set(
        jsonb_set(files - 'firelaunch.json', '{vegalaunch.json}', files->'firelaunch.json', true),
        '{README.md}',
        to_jsonb(replace(replace(files->>'README.md', 'firelaunch.json', 'vegalaunch.json'), 'FireLaunch', 'VegaLaunch')),
        true),
      baseline = jsonb_set(
        jsonb_set(baseline - 'firelaunch.json', '{vegalaunch.json}', baseline->'firelaunch.json', true),
        '{README.md}',
        to_jsonb(replace(replace(baseline->>'README.md', 'firelaunch.json', 'vegalaunch.json'), 'FireLaunch', 'VegaLaunch')),
        true)
  WHERE project_id = 'ch_8d4fccd6f273480cb71ed6ce8cbf269d'
    AND spec_revision = 17
    AND fingerprint = 'a6676da07e008afb0c403bd0f6272da8aa1a0d41f5ba65f9e81fa8c7e95af0c0'
    AND files = baseline
    AND files ? 'firelaunch.json'
    AND baseline ? 'firelaunch.json'
    AND NOT files ? 'vegalaunch.json'
    AND NOT baseline ? 'vegalaunch.json'
    AND md5(files->>'firelaunch.json') = 'b552c67f4feeb2d0c4e3ae1eb6cb305d'
    AND files->>'README.md' LIKE '%firelaunch.json%';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one unchanged saved source; found %', changed;
  END IF;
END $$;
COMMIT;
