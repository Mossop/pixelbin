ALTER TABLE media_file
  ADD COLUMN "needs_metadata" boolean,
  ADD COLUMN "stored" timestamp with time zone;
UPDATE media_file SET "needs_metadata" = TRUE WHERE "process_version" <> 4;
UPDATE media_file SET "needs_metadata" = FALSE WHERE "process_version" = 4;
UPDATE media_file SET "stored" = "uploaded";
ALTER TABLE media_file
  DROP COLUMN "process_version",
  ALTER COLUMN "needs_metadata" SET NOT NULL;

ALTER TABLE alternate_file
  ADD COLUMN "stored" timestamp with time zone;
UPDATE alternate_file SET "stored" = media_file."uploaded"
  FROM media_file WHERE media_file."id" = alternate_file."media_file";
