CREATE MATERIALIZED VIEW IF NOT EXISTS "search_relation" AS
  SELECT
    media_search.media, json_agg((SELECT row_to_json(_) FROM (SELECT saved_search.id, saved_search.name) AS _)) AS searches
    FROM saved_search
      JOIN media_search ON media_search.search=saved_search.id
    GROUP BY media_search.media
  WITH DATA;

CREATE INDEX IF NOT EXISTS "search_relation_idx_media" ON "search_relation" USING btree (media);

CREATE OR REPLACE FUNCTION refresh_search_relation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "search_relation";
            RETURN NULL;
          END; $$;

CREATE OR REPLACE TRIGGER "refresh_search_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "saved_search" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_search_relation();

CREATE OR REPLACE TRIGGER "refresh_search_relation"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "media_search" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_search_relation();
