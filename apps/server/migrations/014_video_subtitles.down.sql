-- Refuse a lossy rollback while caption history exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM video_subtitle_tracks) THEN
    RAISE EXCEPTION 'Export and reconcile private subtitle history before schema rollback';
  END IF;
END $$;
DROP TABLE video_subtitle_tracks;
-- Keep the widened MIME constraint so rollback never deletes or invalidates retained private .vtt objects.
