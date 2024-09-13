DROP MATERIALIZED VIEW IF EXISTS "search_relation";

DROP TRIGGER IF EXISTS "refresh_search_relation" ON "saved_search";
DROP TRIGGER IF EXISTS "refresh_search_relation" ON "media_search";

DROP FUNCTION IF EXISTS refresh_search_relation;
