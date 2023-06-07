CREATE OR REPLACE FUNCTION refresh_user_catalogs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
          BEGIN
            REFRESH MATERIALIZED VIEW "user_catalog";
            RETURN NULL;
          END; $$;

-- Types

DO $$ BEGIN
    CREATE TYPE location AS (
        "left" real,
        "right" real,
        top real,
        bottom real
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Old schema

DROP TABLE IF EXISTS "knex_migrations";
DROP TABLE IF EXISTS "knex_migrations_lock";
DROP SEQUENCE IF EXISTS "knex_migrations_id_seq";
DROP SEQUENCE IF EXISTS "knex_migrations_lock_index_seq";

-- Tables

ALTER TABLE IF EXISTS "Album" RENAME TO "album";
CREATE TABLE IF NOT EXISTS "album" (
    id character varying(30) NOT NULL,
    parent character varying(30),
    name text NOT NULL,
    catalog character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "AlternateFile" RENAME COLUMN "fileName" TO "file_name";
ALTER TABLE IF EXISTS "AlternateFile" RENAME COLUMN "fileSize" TO "file_size";
ALTER TABLE IF EXISTS "AlternateFile" RENAME COLUMN "frameRate" TO "frame_rate";
ALTER TABLE IF EXISTS "AlternateFile" RENAME COLUMN "bitRate" TO "bit_rate";
ALTER TABLE IF EXISTS "AlternateFile" RENAME COLUMN "mediaFile" TO "media_file";
ALTER TABLE IF EXISTS "AlternateFile" RENAME TO "alternate_file";
CREATE TABLE IF NOT EXISTS "alternate_file" (
    id character varying(30) NOT NULL,
    type character varying(20) NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    mimetype text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    duration real,
    frame_rate real,
    bit_rate real,
    media_file character varying(30) NOT NULL,
    local boolean NOT NULL
);

ALTER TABLE IF EXISTS "Catalog" RENAME TO "catalog";
CREATE TABLE IF NOT EXISTS "catalog" (
    id character varying(30) NOT NULL,
    name text NOT NULL,
    storage character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "processVersion" TO "process_version";
ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "fileName" TO "file_name";
ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "fileSize" TO "file_size";
ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "frameRate" TO "frame_rate";
ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "bitRate" TO "bit_rate";
ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "shutterSpeed" TO "shutter_speed";
ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "takenZone" TO "taken_zone";
ALTER TABLE IF EXISTS "MediaFile" RENAME COLUMN "focalLength" TO "focal_length";
ALTER TABLE IF EXISTS "MediaFile" RENAME TO "media_file";
CREATE TABLE IF NOT EXISTS "media_file" (
    id character varying(30) NOT NULL,
    uploaded timestamp with time zone NOT NULL,
    process_version integer NOT NULL,
    file_name text NOT NULL,
    file_size integer NOT NULL,
    mimetype text NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    duration real,
    frame_rate real,
    bit_rate real,
    filename text,
    title text,
    description text,
    label text,
    category text,
    location text,
    city text,
    state text,
    country text,
    make text,
    model text,
    lens text,
    photographer text,
    shutter_speed text,
    taken_zone text,
    orientation integer,
    iso integer,
    rating integer,
    longitude real,
    latitude real,
    altitude real,
    aperture real,
    focal_length real,
    taken timestamp without time zone,
    media character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "MediaInfo" RENAME COLUMN "shutterSpeed" TO "shutter_speed";
ALTER TABLE IF EXISTS "MediaInfo" RENAME COLUMN "takenZone" TO "taken_zone";
ALTER TABLE IF EXISTS "MediaInfo" RENAME COLUMN "focalLength" TO "focal_length";
ALTER TABLE IF EXISTS "MediaInfo" RENAME COLUMN "mediaFile" TO "media_file";
ALTER TABLE IF EXISTS "MediaInfo" RENAME TO "media_item";
CREATE TABLE IF NOT EXISTS "media_item" (
    id character varying(30) NOT NULL,
    deleted boolean NOT NULL,
    created timestamp with time zone NOT NULL,
    updated timestamp with time zone NOT NULL,
    filename text,
    title text,
    description text,
    label text,
    category text,
    location text,
    city text,
    state text,
    country text,
    make text,
    model text,
    lens text,
    photographer text,
    shutter_speed text,
    taken_zone text,
    orientation integer,
    iso integer,
    rating integer,
    longitude real,
    latitude real,
    altitude real,
    aperture real,
    focal_length real,
    taken timestamp without time zone,
    catalog character varying(30) NOT NULL,
    media_file character varying(30)
);

ALTER TABLE IF EXISTS "Media_Album" RENAME TO "media_album";
CREATE TABLE IF NOT EXISTS "media_album" (
    catalog character varying(30) NOT NULL,
    media character varying(30) NOT NULL,
    album character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "Media_Person" RENAME TO "media_person";
CREATE TABLE IF NOT EXISTS "media_person" (
    catalog character varying(30) NOT NULL,
    media character varying(30) NOT NULL,
    person character varying(30) NOT NULL,
    location location
);

ALTER TABLE IF EXISTS "Media_Tag" RENAME TO "media_tag";
CREATE TABLE IF NOT EXISTS "media_tag" (
    catalog character varying(30) NOT NULL,
    media character varying(30) NOT NULL,
    tag character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "Person" RENAME TO "person";
CREATE TABLE IF NOT EXISTS "person" (
    id character varying(30) NOT NULL,
    name text NOT NULL,
    catalog character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "SavedSearch" RENAME TO "saved_search";
CREATE TABLE IF NOT EXISTS "saved_search" (
    id character varying(30) NOT NULL,
    name text NOT NULL,
    shared boolean NOT NULL,
    query json NOT NULL,
    catalog character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "Shared_Catalog" RENAME TO "shared_catalog";
CREATE TABLE IF NOT EXISTS "shared_catalog" (
    writable boolean NOT NULL,
    "user" character varying(30) NOT NULL,
    catalog character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "Storage" RENAME COLUMN "accessKeyId" TO "access_key_id";
ALTER TABLE IF EXISTS "Storage" RENAME COLUMN "secretAccessKey" TO "secret_access_key";
ALTER TABLE IF EXISTS "Storage" RENAME COLUMN "publicUrl" TO "public_url";
ALTER TABLE IF EXISTS "Storage" RENAME TO "storage";
CREATE TABLE IF NOT EXISTS "storage" (
    id character varying(30) NOT NULL,
    name text NOT NULL,
    access_key_id text NOT NULL,
    secret_access_key text NOT NULL,
    bucket text NOT NULL,
    region text NOT NULL,
    path text,
    endpoint text,
    public_url text,
    owner character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "Tag" RENAME TO "tag";
CREATE TABLE IF NOT EXISTS "tag" (
    id character varying(30) NOT NULL,
    parent character varying(30),
    name text NOT NULL,
    catalog character varying(30) NOT NULL
);

ALTER TABLE IF EXISTS "User" RENAME COLUMN "lastLogin" TO "last_login";
ALTER TABLE IF EXISTS "User" RENAME TO "user";
CREATE TABLE IF NOT EXISTS "user" (
    email text NOT NULL,
    password character varying(70),
    fullname text,
    administrator boolean NOT NULL,
    created timestamp with time zone NOT NULL,
    last_login timestamp with time zone,
    verified boolean
);

-- Views

DROP MATERIALIZED VIEW IF EXISTS "UserCatalog";
CREATE MATERIALIZED VIEW IF NOT EXISTS "user_catalog" AS
 SELECT "storage".owner AS "user",
    "catalog".id AS catalog,
    true AS writable
   FROM ("catalog"
     JOIN "storage" ON ((("catalog".storage)::text = ("storage".id)::text)))
UNION
 SELECT "shared_catalog"."user",
    "shared_catalog".catalog,
    "shared_catalog".writable
   FROM "shared_catalog"
  WITH NO DATA;

-- Old foreign keys

ALTER TABLE "album" DROP CONSTRAINT IF EXISTS "foreign_Album";
ALTER TABLE "media_album" DROP CONSTRAINT IF EXISTS "foreign_Album";
ALTER TABLE "person" DROP CONSTRAINT IF EXISTS "foreign_Catalog";
ALTER TABLE "tag" DROP CONSTRAINT IF EXISTS "foreign_Catalog";
ALTER TABLE "album" DROP CONSTRAINT IF EXISTS "foreign_Catalog";
ALTER TABLE "media_item" DROP CONSTRAINT IF EXISTS "foreign_Catalog";
ALTER TABLE "saved_search" DROP CONSTRAINT IF EXISTS "foreign_Catalog";
ALTER TABLE "shared_catalog" DROP CONSTRAINT IF EXISTS "foreign_Catalog";
ALTER TABLE "alternate_file" DROP CONSTRAINT IF EXISTS "foreign_MediaFile";
ALTER TABLE "media_item" DROP CONSTRAINT IF EXISTS "foreign_MediaFile";
ALTER TABLE "media_file" DROP CONSTRAINT IF EXISTS "foreign_MediaInfo";
ALTER TABLE "media_album" DROP CONSTRAINT IF EXISTS "foreign_MediaInfo";
ALTER TABLE "media_tag" DROP CONSTRAINT IF EXISTS "foreign_MediaInfo";
ALTER TABLE "media_person" DROP CONSTRAINT IF EXISTS "foreign_MediaInfo";
ALTER TABLE "media_person" DROP CONSTRAINT IF EXISTS "foreign_Person";
ALTER TABLE "catalog" DROP CONSTRAINT IF EXISTS "foreign_Storage";
ALTER TABLE "tag" DROP CONSTRAINT IF EXISTS "foreign_Tag";
ALTER TABLE "media_tag" DROP CONSTRAINT IF EXISTS "foreign_Tag";
ALTER TABLE "storage" DROP CONSTRAINT IF EXISTS "foreign_User";
ALTER TABLE "shared_catalog" DROP CONSTRAINT IF EXISTS "foreign_User";

-- Primary keys

ALTER TABLE "album"
    DROP CONSTRAINT IF EXISTS "Album_pkey";
ALTER TABLE "album"
    ADD CONSTRAINT "album_pkey" PRIMARY KEY (id);

ALTER TABLE "alternate_file"
    DROP CONSTRAINT IF EXISTS "AlternateFile_pkey";
ALTER TABLE "alternate_file"
    ADD CONSTRAINT "alternate_file_pkey" PRIMARY KEY (id);

ALTER TABLE "catalog"
    DROP CONSTRAINT IF EXISTS "Catalog_pkey";
ALTER TABLE "catalog"
    ADD CONSTRAINT "catalog_pkey" PRIMARY KEY (id);

ALTER TABLE "media_file"
    DROP CONSTRAINT IF EXISTS "MediaFile_pkey";
ALTER TABLE "media_file"
    ADD CONSTRAINT "media_file_pkey" PRIMARY KEY (id);

ALTER TABLE "media_item"
    DROP CONSTRAINT IF EXISTS "MediaInfo_pkey";
ALTER TABLE "media_item"
    ADD CONSTRAINT "media_item_pkey" PRIMARY KEY (id);

ALTER TABLE "person"
    DROP CONSTRAINT IF EXISTS "Person_pkey";
ALTER TABLE "person"
    ADD CONSTRAINT "person_pkey" PRIMARY KEY (id);

ALTER TABLE "saved_search"
    DROP CONSTRAINT IF EXISTS "SavedSearch_pkey";
ALTER TABLE "saved_search"
    ADD CONSTRAINT "saved_search_pkey" PRIMARY KEY (id);

ALTER TABLE "storage"
    DROP CONSTRAINT IF EXISTS "Storage_pkey";
ALTER TABLE "storage"
    ADD CONSTRAINT "storage_pkey" PRIMARY KEY (id);

ALTER TABLE "tag"
    DROP CONSTRAINT IF EXISTS "Tag_pkey";
ALTER TABLE "tag"
    ADD CONSTRAINT "tag_pkey" PRIMARY KEY (id);

ALTER TABLE "user"
    DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE "user"
    ADD CONSTRAINT "user_pkey" PRIMARY KEY (email);

ALTER TABLE "media_album"
    DROP CONSTRAINT IF EXISTS "unique_Media_Album_media_album";
ALTER TABLE "media_album"
    ADD CONSTRAINT "media_album_pkey" PRIMARY KEY (media, album);

ALTER TABLE "media_person"
    DROP CONSTRAINT IF EXISTS "unique_Media_Person_media_person";
ALTER TABLE "media_person"
    ADD CONSTRAINT "media_person_pkey" PRIMARY KEY (media, person);

ALTER TABLE "media_tag"
    DROP CONSTRAINT IF EXISTS "unique_Media_Tag_media_tag";
ALTER TABLE "media_tag"
    ADD CONSTRAINT "media_tag_pkey" PRIMARY KEY (media, tag);

ALTER TABLE "shared_catalog"
    DROP CONSTRAINT IF EXISTS "unique_Shared_Catalog_user_catalog";
ALTER TABLE "shared_catalog"
    ADD CONSTRAINT "shared_catalog_pkey" PRIMARY KEY ("user", catalog);

-- Unneeded?
ALTER TABLE "album"
    DROP CONSTRAINT IF EXISTS "unique_Album_id";
ALTER TABLE "alternate_file"
    DROP CONSTRAINT IF EXISTS "unique_AlternateFile_id";
ALTER TABLE "catalog"
    DROP CONSTRAINT IF EXISTS "unique_Catalog_id";
ALTER TABLE "media_file"
    DROP CONSTRAINT IF EXISTS "unique_MediaFile_id";
ALTER TABLE "media_item"
    DROP CONSTRAINT IF EXISTS "unique_MediaInfo_id";
ALTER TABLE "person"
    DROP CONSTRAINT IF EXISTS "unique_Person_id";
ALTER TABLE "saved_search"
    DROP CONSTRAINT IF EXISTS "unique_SavedSearch_id";
ALTER TABLE "storage"
    DROP CONSTRAINT IF EXISTS "unique_Storage_id";
ALTER TABLE "tag"
    DROP CONSTRAINT IF EXISTS "unique_Tag_id";
ALTER TABLE "user"
    DROP CONSTRAINT IF EXISTS "unique_User_email";

-- Foreign key indexes

ALTER TABLE "album"
    DROP CONSTRAINT IF EXISTS "unique_Album_catalog_id";
ALTER TABLE "album"
    ADD CONSTRAINT "album_unique_catalog_id" UNIQUE (catalog, id);

ALTER TABLE "person"
    DROP CONSTRAINT IF EXISTS "unique_Person_catalog_id";
ALTER TABLE "person"
    ADD CONSTRAINT "person_unique_catalog_id" UNIQUE (catalog, id);

ALTER TABLE "tag"
    DROP CONSTRAINT IF EXISTS "unique_Tag_catalog_id";
ALTER TABLE "tag"
    ADD CONSTRAINT "tag_unique_catalog_id" UNIQUE (catalog, id);

ALTER TABLE "media_item"
    DROP CONSTRAINT IF EXISTS "unique_MediaInfo_catalog_id";
ALTER TABLE "media_item"
    ADD CONSTRAINT "media_item_unique_catalog_id" UNIQUE (catalog, id);

-- Sanity

ALTER TABLE "media_item"
    DROP CONSTRAINT IF EXISTS "unique_MediaInfo_mediaFile";
ALTER TABLE "media_item"
    ADD CONSTRAINT "media_item_unique_media_file" UNIQUE ("media_file");

ALTER INDEX IF EXISTS "idx_AlternateFile_mediaFile_type" RENAME TO "alternate_file_idx_media_file_type";
CREATE INDEX IF NOT EXISTS "alternate_file_idx_media_file_type" ON "alternate_file" USING btree ("media_file", type);

ALTER INDEX IF EXISTS "idx_MediaFile_media" RENAME TO "media_file_idx_media";
CREATE INDEX IF NOT EXISTS "media_file_idx_media" ON "media_file" USING btree (media);

ALTER INDEX IF EXISTS "idx_MediaInfo_catalog" RENAME TO "media_item_idx_catalog";
CREATE INDEX IF NOT EXISTS "media_item_idx_catalog" ON "media_item" USING btree (catalog);

ALTER INDEX IF EXISTS "idx_user_catalog_catalog" RENAME TO "user_catalog_idx_catalog";
CREATE INDEX IF NOT EXISTS "user_catalog_idx_catalog" ON "user_catalog" USING btree (catalog);

ALTER INDEX IF EXISTS "idx_user_catalog_user" RENAME TO "user_catalog_idx_user";
CREATE INDEX IF NOT EXISTS "user_catalog_idx_user" ON "user_catalog" USING btree ("user");

ALTER INDEX IF EXISTS "unique_Album_catalog_parent_name" RENAME TO "album_unique_catalog_parent_name";
CREATE UNIQUE INDEX IF NOT EXISTS "album_unique_catalog_parent_name" ON "album" USING btree (COALESCE(parent, catalog), lower(name));

ALTER INDEX IF EXISTS "unique_Person_catalog_name" RENAME TO "person_unique_catalog_name";
CREATE UNIQUE INDEX IF NOT EXISTS "person_unique_catalog_name" ON "person" USING btree (catalog, lower(name));

ALTER INDEX IF EXISTS "unique_Tag_catalog_parent_name" RENAME TO "tag_unique_catalog_parent_name";
CREATE UNIQUE INDEX IF NOT EXISTS "tag_unique_catalog_parent_name" ON "tag" USING btree (COALESCE(parent, catalog), lower(name));

CREATE OR REPLACE TRIGGER "refresh_user_catalogs_from_catalogs" AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "catalog" FOR EACH STATEMENT EXECUTE FUNCTION refresh_user_catalogs();
CREATE OR REPLACE TRIGGER "refresh_user_catalogs_from_shared_catalogs" AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON "shared_catalog" FOR EACH STATEMENT EXECUTE FUNCTION refresh_user_catalogs();

DROP TRIGGER IF EXISTS "refreshUserCatalogsFromCatalogs" ON "catalog";
DROP TRIGGER IF EXISTS "refreshUserCatalogsFromSharedCatalogs" ON "shared_catalog";

DROP FUNCTION IF EXISTS refreshusercatalogs();

-- Foreign keys

ALTER TABLE "album"
    ADD CONSTRAINT "foreign_album" FOREIGN KEY (catalog, parent) REFERENCES "album"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "media_album"
    ADD CONSTRAINT "foreign_album" FOREIGN KEY (catalog, album) REFERENCES "album"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "person"
    ADD CONSTRAINT "foreign_catalog" FOREIGN KEY (catalog) REFERENCES "catalog"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "tag"
    ADD CONSTRAINT "foreign_catalog" FOREIGN KEY (catalog) REFERENCES "catalog"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "album"
    ADD CONSTRAINT "foreign_catalog" FOREIGN KEY (catalog) REFERENCES "catalog"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "media_item"
    ADD CONSTRAINT "foreign_catalog" FOREIGN KEY (catalog) REFERENCES "catalog"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "saved_search"
    ADD CONSTRAINT "foreign_catalog" FOREIGN KEY (catalog) REFERENCES "catalog"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "shared_catalog"
    ADD CONSTRAINT "foreign_catalog" FOREIGN KEY (catalog) REFERENCES "catalog"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "alternate_file"
    ADD CONSTRAINT "foreign_media_file" FOREIGN KEY ("media_file") REFERENCES "media_file"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "media_item"
    ADD CONSTRAINT "foreign_media_file" FOREIGN KEY ("media_file") REFERENCES "media_file"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "media_file"
    ADD CONSTRAINT "foreign_media_item" FOREIGN KEY (media) REFERENCES "media_item"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "media_album"
    ADD CONSTRAINT "foreign_media_item" FOREIGN KEY (catalog, media) REFERENCES "media_item"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "media_tag"
    ADD CONSTRAINT "foreign_media_item" FOREIGN KEY (catalog, media) REFERENCES "media_item"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "media_person"
    ADD CONSTRAINT "foreign_media_item" FOREIGN KEY (catalog, media) REFERENCES "media_item"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "media_person"
    ADD CONSTRAINT "foreign_person" FOREIGN KEY (catalog, person) REFERENCES "person"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "catalog"
    ADD CONSTRAINT "foreign_storage" FOREIGN KEY (storage) REFERENCES "storage"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "tag"
    ADD CONSTRAINT "foreign_tag" FOREIGN KEY (catalog, parent) REFERENCES "tag"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "media_tag"
    ADD CONSTRAINT "foreign_tag" FOREIGN KEY (catalog, tag) REFERENCES "tag"(catalog, id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "storage"
    ADD CONSTRAINT "foreign_user" FOREIGN KEY (owner) REFERENCES "user"(email) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "shared_catalog"
    ADD CONSTRAINT "foreign_user" FOREIGN KEY ("user") REFERENCES "user"(email) ON UPDATE CASCADE ON DELETE CASCADE;

REFRESH MATERIALIZED VIEW "user_catalog";
