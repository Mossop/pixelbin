CREATE MATERIALIZED VIEW IF NOT EXISTS "album_descendent" AS
  WITH RECURSIVE descendents AS (
    SELECT id as id, id as descendent from album
  UNION ALL
    SELECT descendents.id, album.id FROM album JOIN descendents ON album.parent = descendents.descendent
  )
  SELECT id, descendent FROM descendents
  WITH DATA;

CREATE INDEX IF NOT EXISTS "album_descendent_idx_id" ON "album_descendent" USING btree (id);

CREATE MATERIALIZED VIEW IF NOT EXISTS "tag_descendent" AS
  WITH RECURSIVE descendents AS (
    SELECT id as id, id as descendent from tag
  UNION ALL
    SELECT descendents.id, tag.id FROM tag JOIN descendents ON tag.parent = descendents.descendent
  )
  SELECT id, descendent FROM descendents
  WITH DATA;

CREATE INDEX IF NOT EXISTS "tag_descendent_idx_id" ON "tag_descendent" USING btree (id);

CREATE OR REPLACE FUNCTION refresh_album_descendents() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "album_descendent";
            RETURN NULL;
          END; $$;

CREATE OR REPLACE FUNCTION refresh_tag_descendents() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "tag_descendent";
            RETURN NULL;
          END; $$;

CREATE OR REPLACE TRIGGER "refresh_album_descendents"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "album" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_album_descendents();
CREATE OR REPLACE TRIGGER "refresh_tag_descendents"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "tag" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_tag_descendents();
