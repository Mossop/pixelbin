DROP TRIGGER IF EXISTS "refresh_media_file_alternates" ON "alternate_file";

DROP FUNCTION IF EXISTS refresh_media_file_alternates;

DROP MATERIALIZED VIEW IF EXISTS "media_file_alternates";
