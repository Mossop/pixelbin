ALTER TABLE media_file ADD COLUMN "shutter_speed_temp" text;
UPDATE media_file SET "shutter_speed_temp" = CAST("shutter_speed" AS text) WHERE "shutter_speed" IS NOT NULL;
ALTER TABLE media_file DROP COLUMN "shutter_speed";
ALTER TABLE media_file RENAME COLUMN "shutter_speed_temp" TO "shutter_speed";

ALTER TABLE media_item ADD COLUMN "shutter_speed_temp" text;
UPDATE media_item SET "shutter_speed_temp" = CAST("shutter_speed" AS text) WHERE "shutter_speed" IS NOT NULL;
ALTER TABLE media_item DROP COLUMN "shutter_speed";
ALTER TABLE media_item RENAME COLUMN "shutter_speed_temp" TO "shutter_speed";
