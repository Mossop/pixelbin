ALTER TABLE media_file ADD COLUMN "shutter_speed_temp" real;
UPDATE media_file SET "shutter_speed_temp" = 1 / CAST(SUBSTRING("shutter_speed" FROM 3) AS real) WHERE SUBSTRING("shutter_speed" FOR 2) = '1/';
UPDATE media_file SET "shutter_speed_temp" = CAST("shutter_speed" AS real) WHERE "shutter_speed" ~ '^(-)?\d+(\.\d+)?$';
ALTER TABLE media_file DROP COLUMN "shutter_speed";
ALTER TABLE media_file RENAME COLUMN "shutter_speed_temp" TO "shutter_speed";

ALTER TABLE media_item ADD COLUMN "shutter_speed_temp" real;
UPDATE media_item SET "shutter_speed_temp" = 1 / CAST(SUBSTRING("shutter_speed" FROM 3) AS real) WHERE SUBSTRING("shutter_speed" FOR 2) = '1/';
UPDATE media_item SET "shutter_speed_temp" = CAST("shutter_speed" AS real) WHERE "shutter_speed" ~ '^(-)?\d+(\.\d+)?$';
ALTER TABLE media_item DROP COLUMN "shutter_speed";
ALTER TABLE media_item RENAME COLUMN "shutter_speed_temp" TO "shutter_speed";
