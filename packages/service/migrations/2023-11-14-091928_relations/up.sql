CREATE MATERIALIZED VIEW IF NOT EXISTS "tag_relation" AS
  SELECT
    media_tag.media, json_agg((SELECT row_to_json(_) FROM (SELECT tag.id, tag.name) AS _)) AS tags
    FROM tag
      JOIN media_tag ON media_tag.tag=tag.id
    GROUP BY media_tag.media
  WITH DATA;

CREATE INDEX IF NOT EXISTS "tag_relation_idx_media" ON "tag_relation" USING btree (media);

CREATE OR REPLACE FUNCTION refresh_tag_relation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "tag_relation";
            RETURN NULL;
          END; $$;

CREATE OR REPLACE TRIGGER "refresh_tag_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "tag" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_tag_relation();

CREATE OR REPLACE TRIGGER "refresh_tag_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "media_tag" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_tag_relation();

CREATE MATERIALIZED VIEW IF NOT EXISTS "album_relation" AS
  SELECT
    media_album.media, json_agg((SELECT row_to_json(_) FROM (SELECT album.id, album.name) AS _)) AS albums
    FROM album
      JOIN media_album ON media_album.album=album.id
    GROUP BY media_album.media
  WITH DATA;

CREATE INDEX IF NOT EXISTS "album_relation_idx_media" ON "album_relation" USING btree (media);

CREATE OR REPLACE FUNCTION refresh_album_relation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "album_relation";
            RETURN NULL;
          END; $$;

CREATE OR REPLACE TRIGGER "refresh_album_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "album" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_album_relation();

CREATE OR REPLACE TRIGGER "refresh_album_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "media_album" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_album_relation();

CREATE MATERIALIZED VIEW IF NOT EXISTS "person_relation" AS
  SELECT
    media_person.media, json_agg((SELECT row_to_json(_) FROM (SELECT person.id, person.name, media_person.location) AS _)) AS people
    FROM person
      JOIN media_person ON media_person.person=person.id
    GROUP BY media_person.media
  WITH DATA;

CREATE INDEX IF NOT EXISTS "person_relation_idx_media" ON "person_relation" USING btree (media);

CREATE OR REPLACE FUNCTION refresh_person_relation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "person_relation";
            RETURN NULL;
          END; $$;

CREATE OR REPLACE TRIGGER "refresh_person_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "person" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_person_relation();

CREATE OR REPLACE TRIGGER "refresh_person_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "media_person" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_person_relation();
