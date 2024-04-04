CREATE MATERIALIZED VIEW IF NOT EXISTS "media_file_alternates" AS
  SELECT
    media_file, json_agg(alternate_file.*) AS alternates
  FROM alternate_file
  GROUP BY media_file;

CREATE INDEX IF NOT EXISTS "media_file_alternates_idx_media_file" ON "media_file_alternates" USING btree (media_file);

CREATE OR REPLACE FUNCTION refresh_media_file_alternates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "media_file_alternates";
            RETURN NULL;
          END; $$;

CREATE OR REPLACE TRIGGER "refresh_media_file_alternates"
  AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "alternate_file" FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_media_file_alternates();
