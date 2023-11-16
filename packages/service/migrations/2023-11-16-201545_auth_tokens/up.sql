CREATE TABLE IF NOT EXISTS "auth_token" (
    email text NOT NULL,
    token character varying(30) NOT NULL,
    expiry timestamp with time zone
);

ALTER TABLE "auth_token"
    ADD CONSTRAINT "auth_token_pkey" PRIMARY KEY (email);

ALTER TABLE "auth_token"
    ADD CONSTRAINT "foreign_user" FOREIGN KEY (email) REFERENCES "user"(email) ON UPDATE CASCADE ON DELETE CASCADE;
