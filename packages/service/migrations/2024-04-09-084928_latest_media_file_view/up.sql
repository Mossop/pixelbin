CREATE VIEW "latest_media_file" AS
  SELECT DISTINCT ON ("media_item") "media_file".*
    FROM "media_file"
    WHERE "stored" IS NOT NULL AND NOT "needs_metadata" AND "id" NOT IN (
      SELECT "media_file" FROM "alternate_file" WHERE "stored" IS NULL
    )
    ORDER BY "media_item", "uploaded" DESC;
