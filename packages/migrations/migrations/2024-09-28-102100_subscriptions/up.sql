CREATE TABLE IF NOT EXISTS "subscription_request" (
    token character varying(30) NOT NULL PRIMARY KEY,
    email text NOT NULL,
    search character varying(30) NOT NULL,
    request timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "foreign_search" FOREIGN KEY (search) REFERENCES "saved_search"(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "subscription" (
    email text NOT NULL,
    search character varying(30) NOT NULL,
    CONSTRAINT "foreign_search" FOREIGN KEY (search) REFERENCES "saved_search"(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_idx_email_search" ON "subscription" USING btree (email, search);

ALTER TABLE "saved_search"
ADD COLUMN "last_update" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP;
