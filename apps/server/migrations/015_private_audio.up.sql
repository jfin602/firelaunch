-- Bounded two-hour MP3 originals. All other private objects retain the old limit.
ALTER TABLE private_objects DROP CONSTRAINT private_objects_byte_size_check;
ALTER TABLE private_objects ADD CONSTRAINT private_objects_byte_size_check
  CHECK (byte_size >= 0 AND
    ((content_type = 'audio/mpeg' AND byte_size <= 320000000) OR
     (content_type <> 'audio/mpeg' AND byte_size <= 1048576)));
