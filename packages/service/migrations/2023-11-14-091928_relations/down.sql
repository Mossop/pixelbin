DROP MATERIALIZED VIEW IF EXISTS "tag_relation";

DROP TRIGGER IF EXISTS "refresh_tag_relation" ON "tag";
DROP TRIGGER IF EXISTS "refresh_tag_relation" ON "media_tag";

DROP FUNCTION IF EXISTS refresh_tag_relation;

DROP MATERIALIZED VIEW IF EXISTS "album_relation";

DROP TRIGGER IF EXISTS "refresh_album_relation" ON "album";
DROP TRIGGER IF EXISTS "refresh_album_relation" ON "media_album";

DROP FUNCTION IF EXISTS refresh_album_relation;

DROP MATERIALIZED VIEW IF EXISTS "person_relation";

DROP TRIGGER IF EXISTS "refresh_person_relation" ON "person";
DROP TRIGGER IF EXISTS "refresh_person_relation" ON "media_person";

DROP FUNCTION IF EXISTS refresh_person_relation;
