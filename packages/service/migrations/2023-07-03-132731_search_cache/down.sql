DROP TABLE IF EXISTS "media_search";

ALTER TABLE "saved_search"
    DROP CONSTRAINT "saved_search_unique_catalog_id";
