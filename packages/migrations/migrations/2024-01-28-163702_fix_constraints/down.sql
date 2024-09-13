ALTER TABLE "alternate_file"
    DROP CONSTRAINT "foreign_media_file";
ALTER TABLE "alternate_file"
    ADD CONSTRAINT "foreign_media_file" FOREIGN KEY ("media_file") REFERENCES "media_file"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "media_item"
    DROP CONSTRAINT "foreign_media_file";
ALTER TABLE "media_item"
    ADD CONSTRAINT "foreign_media_file" FOREIGN KEY ("media_file") REFERENCES "media_file"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "media_file"
    DROP CONSTRAINT "foreign_media_item";
ALTER TABLE "media_file"
    ADD CONSTRAINT "foreign_media_item" FOREIGN KEY (media_item) REFERENCES "media_item"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
