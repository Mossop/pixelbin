WITH
    users_catalogs AS (
        SELECT catalog.*,writable 
        FROM user_catalog
            JOIN catalog ON catalog.id=user_catalog.catalog
        WHERE "user"=$1
    ),
    users_storage AS (
        SELECT id, name, bucket, region, path, endpoint, public_url AS publicUrl
        FROM storage WHERE owner=$1
    ),
    users_albums AS (
        SELECT album.*, COUNT(media_album.media) AS media
        FROM album LEFT JOIN media_album ON media_album.album=album.id
        WHERE album.catalog IN (SELECT id FROM users_catalogs)
        GROUP BY album.id
    ),
    users_tags AS (
        SELECT tag.*
        FROM tag
        WHERE catalog IN (SELECT id FROM users_catalogs)
    ),
    users_people AS (
        SELECT person.*
        FROM person
        WHERE catalog IN (SELECT id FROM users_catalogs)
    ),
    users_searches AS (
        SELECT saved_search.*, COUNT(media_search.media) AS media
        FROM saved_search LEFT JOIN media_search ON media_search.search=saved_search.id
        WHERE saved_search.catalog IN (SELECT id FROM users_catalogs)
        GROUP BY saved_search.id
    )
SELECT
    "user".email,
    "user".fullname,
    "user".administrator,
    "user".created,
    "user".last_login,
    "user".verified,
    COALESCE(catalogs, '[]'::json) AS catalogs,
    COALESCE(storage, '[]'::json) AS storage,
    COALESCE(albums, '[]'::json) AS albums,
    COALESCE(tags, '[]'::json) AS tags,
    COALESCE(people, '[]'::json) AS people,
    COALESCE(searches, '[]'::json) AS searches
FROM "user",
    (SELECT json_agg(users_catalogs.*) AS catalogs FROM users_catalogs) AS cat_agg,
    (SELECT json_agg(users_storage.*) AS storage FROM users_storage) AS stg_agg,
    (SELECT json_agg(users_albums.*) AS albums FROM users_albums) AS alb_agg,
    (SELECT json_agg(users_tags.*) AS tags FROM users_tags) AS tag_agg,
    (SELECT json_agg(users_people.*) AS people FROM users_people) AS ppl_agg,
    (SELECT json_agg(users_searches.*) AS searches FROM users_searches) AS srch_agg
WHERE
    email=$1
