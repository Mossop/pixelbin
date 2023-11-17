DROP MATERIALIZED VIEW IF EXISTS "album_descendent";
DROP MATERIALIZED VIEW IF EXISTS "tag_descendent";

DROP TRIGGER IF EXISTS "refresh_album_descendents" ON "album";
DROP TRIGGER IF EXISTS "refresh_tag_descendents" ON "tag";

DROP FUNCTION IF EXISTS refresh_album_descendents;
DROP FUNCTION IF EXISTS refresh_tag_descendents;
