ALTER TABLE "alternate_file" ADD COLUMN "required" boolean DEFAULT FALSE;

UPDATE "alternate_file" SET "required" = TRUE
WHERE
  "type"='thumbnail' AND "mimetype"='image/jpeg';

UPDATE "alternate_file" SET "required" = TRUE
FROM "media_file"
WHERE
  "media_file"."id"="alternate_file"."media_file" AND "media_file"."mimetype" LIKE 'image/%' AND
  "type"='reencode' AND "alternate_file"."mimetype"='image/jpeg';

UPDATE "alternate_file" SET "required" = TRUE
FROM "media_file"
WHERE
  "media_file"."id"="alternate_file"."media_file" AND "media_file"."mimetype" LIKE 'video/%' AND
  "type"='reencode' AND "alternate_file"."mimetype"='video/mp4';

ALTER TABLE "alternate_file"
  ALTER COLUMN "required" SET NOT NULL,
  ALTER COLUMN "required" DROP DEFAULT;

CREATE OR REPLACE VIEW "latest_media_file" AS
  SELECT DISTINCT ON ("media_item") "media_file".*
    FROM "media_file"
    WHERE
      NOT "needs_metadata" AND
      "id" NOT IN (
        SELECT DISTINCT "media_file"
        FROM "alternate_file"
        WHERE "stored" IS NULL AND "required"
      )
    ORDER BY "media_item", "uploaded" DESC;
