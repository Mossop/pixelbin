DROP VIEW IF EXISTS media_view;
CREATE VIEW media_view AS SELECT
    media_item.id,
    media_item.catalog,
    media_item.created,
    media_item.datetime,
    media_item.public,
    media_item.taken_zone,
    COALESCE(media_item.filename, media_file.filename) AS filename,
    COALESCE(media_item.title, media_file.title) AS title,
    COALESCE(media_item.description, media_file.description) AS description,
    COALESCE(media_item.label, media_file.label) AS label,
    COALESCE(media_item.category, media_file.category) AS category,
    COALESCE(media_item.location, media_file.location) AS location,
    COALESCE(media_item.city, media_file.city) AS city,
    COALESCE(media_item.state, media_file.state) AS state,
    COALESCE(media_item.country, media_file.country) AS country,
    COALESCE(media_item.make, media_file.make) AS make,
    COALESCE(media_item.model, media_file.model) AS model,
    COALESCE(media_item.lens, media_file.lens) AS lens,
    COALESCE(media_item.photographer, media_file.photographer) AS photographer,
    COALESCE(media_item.shutter_speed, media_file.shutter_speed) AS shutter_speed,
    COALESCE(media_item.orientation, media_file.orientation) AS orientation,
    COALESCE(media_item.iso, media_file.iso) AS iso,
    COALESCE(media_item.rating, media_file.rating) AS rating,
    COALESCE(media_item.longitude, media_file.longitude) AS longitude,
    COALESCE(media_item.latitude, media_file.latitude) AS latitude,
    COALESCE(media_item.altitude, media_file.altitude) AS altitude,
    COALESCE(media_item.aperture, media_file.aperture) AS aperture,
    COALESCE(media_item.focal_length, media_file.focal_length) AS focal_length,
    COALESCE(media_item.taken, media_file.taken) AS taken,
    media_item.media_file,
    media_file.file_size,
    media_file.mimetype,
    media_file.width,
    media_file.height,
    media_file.duration,
    media_file.frame_rate,
    media_file.bit_rate,
    media_file.uploaded,
    media_file.file_name,
    COALESCE(media_file_alternates.alternates, '[]'::json) AS alternates
FROM
    media_item
    LEFT JOIN media_file ON media_item.media_file=media_file.id
    LEFT JOIN media_file_alternates ON media_file.id=media_file_alternates.media_file
WHERE NOT deleted;

ALTER TABLE media_item DROP COLUMN "updated";
