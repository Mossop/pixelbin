ALTER TABLE media_item ADD COLUMN "public" boolean;
UPDATE media_item SET "public"=false;
ALTER TABLE media_item ALTER COLUMN "public" SET NOT NULL;
