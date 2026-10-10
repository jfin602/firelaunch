DROP TABLE catalog_media_rights_events;
ALTER TABLE private_objects DROP CONSTRAINT private_objects_kind_matches_id;
ALTER TABLE catalog_media_assets
  DROP CONSTRAINT catalog_media_display_evidence_owned,
  DROP CONSTRAINT catalog_media_playback_evidence_owned,
  DROP CONSTRAINT catalog_media_private_object_owned,
  DROP CONSTRAINT catalog_media_display_evidence_format,
  DROP CONSTRAINT catalog_media_playback_evidence_format,
  DROP CONSTRAINT catalog_media_private_object_format,
  DROP COLUMN display_evidence_id,
  DROP COLUMN playback_evidence_id,
  DROP COLUMN private_object_id;
