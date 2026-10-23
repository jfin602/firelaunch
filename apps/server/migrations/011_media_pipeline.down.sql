DROP TRIGGER media_rendition_immutable ON media_rendition_sets;
DROP FUNCTION vegalaunch_rendition_immutable();
ALTER TABLE media_processing_jobs DROP CONSTRAINT media_jobs_rendition_owned;
DROP TABLE media_rendition_sets;
DROP TABLE media_processing_jobs;
DROP TABLE media_upload_sessions;
DROP TABLE media_asset_lifecycle;
ALTER TABLE catalog_media_assets DROP CONSTRAINT catalog_media_assets_pipeline_scope;
