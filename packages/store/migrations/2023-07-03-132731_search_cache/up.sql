CREATE TABLE IF NOT EXISTS "media_search" (
    catalog character varying(30) NOT NULL,
    media character varying(30) NOT NULL,
    search character varying(30) NOT NULL,
    added timestamp with time zone NOT NULL
);

ALTER TABLE "media_search"
    ADD CONSTRAINT "media_search_pkey" PRIMARY KEY (media, search);

ALTER TABLE "saved_search"
    ADD CONSTRAINT "saved_search_unique_catalog_id" UNIQUE (catalog, id);

ALTER TABLE "media_search"
    ADD CONSTRAINT "foreign_search" FOREIGN KEY (catalog, search) REFERENCES "saved_search"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "media_search"
    ADD CONSTRAINT "foreign_media_item" FOREIGN KEY (catalog, media) REFERENCES "media_item"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;
