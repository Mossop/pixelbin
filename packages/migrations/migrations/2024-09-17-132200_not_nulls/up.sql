UPDATE "user" SET verified=FALSE WHERE verified IS NULL;
ALTER TABLE "user" ALTER COLUMN "verified" SET NOT NULL;
