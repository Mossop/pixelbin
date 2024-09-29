DROP INDEX IF EXISTS "subscription_idx_email_search";
DROP TABLE IF EXISTS "subscription";
DROP TABLE IF EXISTS "subscription_request";

ALTER TABLE "saved_search"
DROP COLUMN IF EXISTS "last_update";
