-- One-time, owner-requested rename of confirmed synthetic qualification metadata.
-- The original uploaded bytes, object keys, opaque IDs, and source filenames are untouched.
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM catalog_items WHERE id IN (
      'ci_89dccb10c21b44feacb028469086cbd3',
      'ci_dc0de578e9734832a6f65a31f92af633',
      'ci_e58de794c8964c798a66fdcbcbf7619d',
      'ci_a99330e94fdd4b8797a5ac001910d19a')) <> 4
    OR (SELECT count(*) FROM catalog_revisions WHERE project_id IN (
      'ch_afc823551f2a4a52bb065507874e44c4',
      'ch_b076c69900364af7a662a4cd4b70f5d8',
      'ch_21ae035aa31743b1a8a98f145ee34f6a')) <> 3
    OR (SELECT record #>> '{creatorOverrides,artworkUrl}' FROM catalog_items WHERE id = 'ci_89dccb10c21b44feacb028469086cbd3') <> 'https://firelaunch.jfin.dev/media/ocean-palette.svg'
    OR (SELECT record #>> '{sourceRecord,metadata,artist}' FROM catalog_items WHERE id = 'ci_dc0de578e9734832a6f65a31f92af633') <> 'FireLaunch Test Fixture'
    OR (SELECT record #>> '{sourceRecord,metadata,author}' FROM catalog_items WHERE id = 'ci_e58de794c8964c798a66fdcbcbf7619d') <> 'FireLaunch Test Author'
    OR (SELECT record #>> '{creatorOverrides,author}' FROM catalog_items WHERE id = 'ci_e58de794c8964c798a66fdcbcbf7619d') <> 'FireLaunch Test Author'
    OR (SELECT record #>> '{creatorOverrides,narrator}' FROM catalog_items WHERE id = 'ci_e58de794c8964c798a66fdcbcbf7619d') <> 'FireLaunch Test Narrator'
    OR (SELECT record #>> '{sourceRecord,metadata,title}' FROM catalog_items WHERE id = 'ci_a99330e94fdd4b8797a5ac001910d19a') <> 'FireLaunch Staging Video Qualification 20261017T0300Z'
    OR (SELECT record #>> '{creatorOverrides,title}' FROM catalog_items WHERE id = 'ci_a99330e94fdd4b8797a5ac001910d19a') <> 'FireLaunch Staging Video Qualification 20261017T0300Z'
  THEN RAISE EXCEPTION 'Synthetic fixture provenance or values differ; no rows changed';
  END IF;
END $$;

UPDATE catalog_items SET record = jsonb_set(record, '{creatorOverrides,artworkUrl}', to_jsonb('https://vegalaunch.jfin.dev/media/ocean-palette.svg'::text))
WHERE id = 'ci_89dccb10c21b44feacb028469086cbd3';
UPDATE catalog_items SET record = jsonb_set(record, '{sourceRecord,metadata,artist}', to_jsonb('VegaLaunch Test Fixture'::text))
WHERE id = 'ci_dc0de578e9734832a6f65a31f92af633';
UPDATE catalog_items SET record = jsonb_set(jsonb_set(jsonb_set(record,
  '{sourceRecord,metadata,author}', to_jsonb('VegaLaunch Test Author'::text)),
  '{creatorOverrides,author}', to_jsonb('VegaLaunch Test Author'::text)),
  '{creatorOverrides,narrator}', to_jsonb('VegaLaunch Test Narrator'::text))
WHERE id = 'ci_e58de794c8964c798a66fdcbcbf7619d';
UPDATE catalog_items SET record = jsonb_set(jsonb_set(record,
  '{sourceRecord,metadata,title}', to_jsonb('VegaLaunch Staging Video Qualification 20261017T0300Z'::text)),
  '{creatorOverrides,title}', to_jsonb('VegaLaunch Staging Video Qualification 20261017T0300Z'::text))
WHERE id = 'ci_a99330e94fdd4b8797a5ac001910d19a';
UPDATE catalog_revisions SET revision = revision + 1
WHERE project_id IN ('ch_afc823551f2a4a52bb065507874e44c4',
  'ch_b076c69900364af7a662a4cd4b70f5d8',
  'ch_21ae035aa31743b1a8a98f145ee34f6a');
COMMIT;
