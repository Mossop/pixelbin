CREATE OR REPLACE VIEW "latest_media_file" AS
  SELECT DISTINCT ON ("media_item") "media_file".*
    FROM "media_file"
    WHERE
      "stored" IS NOT NULL AND
      NOT "needs_metadata" AND
      "id" IN (
        SELECT DISTINCT "media_file"
        FROM "alternate_file"
        WHERE "stored" IS NOT NULL AND "type"='thumbnail' AND "mimetype"='image/jpeg'
      ) AND (
        (
          "mimetype" LIKE 'image/%' AND
          "id" IN (
            SELECT DISTINCT "media_file"
            FROM "alternate_file"
            WHERE "stored" IS NOT NULL AND "type"='reencode' AND "mimetype"='image/jpeg'
          )
        ) OR (
          "mimetype" LIKE 'video/%' AND
          "id" IN (
            SELECT DISTINCT "media_file"
            FROM "alternate_file"
            WHERE "stored" IS NOT NULL AND "type"='reencode' AND "mimetype"='video/mp4'
          )
        )
      )
    ORDER BY "media_item", "uploaded" DESC;

ALTER TABLE "alternate_file" DROP COLUMN "required";
