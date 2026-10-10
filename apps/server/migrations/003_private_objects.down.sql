DROP TABLE private_object_capabilities;
DROP INDEX private_objects_owner_idx;
ALTER TABLE private_objects DROP CONSTRAINT private_objects_content_type;
ALTER TABLE private_objects DROP CONSTRAINT private_objects_key_format;
ALTER TABLE private_objects DROP CONSTRAINT private_objects_id_format;
ALTER TABLE private_objects DROP COLUMN content_type, DROP COLUMN byte_size, DROP COLUMN sha256, DROP COLUMN created_at;
