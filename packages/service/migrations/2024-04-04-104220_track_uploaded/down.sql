ALTER TABLE media_file
  ADD COLUMN "process_version" integer,
  DROP COLUMN "stored";
UPDATE media_file SET "process_version" = 4 WHERE NOT "needs_metadata";
UPDATE media_file SET "process_version" = 0 WHERE "needs_metadata";
ALTER TABLE media_file
  DROP COLUMN "needs_metadata",
  ALTER COLUMN "process_version" SET NOT NULL;

ALTER TABLE alternate_file
  DROP COLUMN "stored";
