ALTER TABLE media_item ADD COLUMN "datetime" timestamp with time zone;
UPDATE media_item SET "datetime" = "created";
ALTER TABLE media_item ALTER COLUMN "datetime" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "media_item_idx_datetime" ON "media_item" USING btree (datetime);

ALTER TABLE media_file DROP COLUMN taken_zone;
