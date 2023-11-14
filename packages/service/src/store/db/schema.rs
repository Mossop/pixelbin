// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "location"))]
    pub struct Location;
}

diesel::table! {
    album (id) {
        id -> Varchar,
        parent -> Nullable<Varchar>,
        name -> Text,
        catalog -> Varchar,
    }
}

diesel::table! {
    alternate_file (id) {
        id -> Varchar,
        #[sql_name = "type"]
        type_ -> Varchar,
        file_name -> Text,
        file_size -> Int4,
        mimetype -> Text,
        width -> Int4,
        height -> Int4,
        duration -> Nullable<Float4>,
        frame_rate -> Nullable<Float4>,
        bit_rate -> Nullable<Float4>,
        media_file -> Varchar,
        local -> Bool,
    }
}

diesel::table! {
    catalog (id) {
        id -> Varchar,
        name -> Text,
        storage -> Varchar,
    }
}

diesel::table! {
    media_album (media, album) {
        catalog -> Varchar,
        media -> Varchar,
        album -> Varchar,
    }
}

diesel::table! {
    media_file (id) {
        id -> Varchar,
        uploaded -> Timestamptz,
        process_version -> Int4,
        file_name -> Text,
        file_size -> Int4,
        mimetype -> Text,
        width -> Int4,
        height -> Int4,
        duration -> Nullable<Float4>,
        frame_rate -> Nullable<Float4>,
        bit_rate -> Nullable<Float4>,
        filename -> Nullable<Text>,
        title -> Nullable<Text>,
        description -> Nullable<Text>,
        label -> Nullable<Text>,
        category -> Nullable<Text>,
        location -> Nullable<Text>,
        city -> Nullable<Text>,
        state -> Nullable<Text>,
        country -> Nullable<Text>,
        make -> Nullable<Text>,
        model -> Nullable<Text>,
        lens -> Nullable<Text>,
        photographer -> Nullable<Text>,
        shutter_speed -> Nullable<Text>,
        taken_zone -> Nullable<Text>,
        orientation -> Nullable<Int4>,
        iso -> Nullable<Int4>,
        rating -> Nullable<Int4>,
        longitude -> Nullable<Float4>,
        latitude -> Nullable<Float4>,
        altitude -> Nullable<Float4>,
        aperture -> Nullable<Float4>,
        focal_length -> Nullable<Float4>,
        taken -> Nullable<Timestamp>,
        media -> Varchar,
    }
}

diesel::table! {
    media_item (id) {
        id -> Varchar,
        deleted -> Bool,
        created -> Timestamptz,
        updated -> Timestamptz,
        filename -> Nullable<Text>,
        title -> Nullable<Text>,
        description -> Nullable<Text>,
        label -> Nullable<Text>,
        category -> Nullable<Text>,
        location -> Nullable<Text>,
        city -> Nullable<Text>,
        state -> Nullable<Text>,
        country -> Nullable<Text>,
        make -> Nullable<Text>,
        model -> Nullable<Text>,
        lens -> Nullable<Text>,
        photographer -> Nullable<Text>,
        shutter_speed -> Nullable<Text>,
        taken_zone -> Nullable<Text>,
        orientation -> Nullable<Int4>,
        iso -> Nullable<Int4>,
        rating -> Nullable<Int4>,
        longitude -> Nullable<Float4>,
        latitude -> Nullable<Float4>,
        altitude -> Nullable<Float4>,
        aperture -> Nullable<Float4>,
        focal_length -> Nullable<Float4>,
        taken -> Nullable<Timestamp>,
        catalog -> Varchar,
        media_file -> Nullable<Varchar>,
        datetime -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::Location;

    media_person (media, person) {
        catalog -> Varchar,
        media -> Varchar,
        person -> Varchar,
        location -> Nullable<Location>,
    }
}

diesel::table! {
    media_search (media, search) {
        catalog -> Varchar,
        media -> Varchar,
        search -> Varchar,
        added -> Timestamptz,
    }
}

diesel::table! {
    media_tag (media, tag) {
        catalog -> Varchar,
        media -> Varchar,
        tag -> Varchar,
    }
}

diesel::table! {
    person (id) {
        id -> Varchar,
        name -> Text,
        catalog -> Varchar,
    }
}

diesel::table! {
    saved_search (id) {
        id -> Varchar,
        name -> Text,
        shared -> Bool,
        query -> Json,
        catalog -> Varchar,
    }
}

diesel::table! {
    shared_catalog (user, catalog) {
        writable -> Bool,
        user -> Varchar,
        catalog -> Varchar,
    }
}

diesel::table! {
    storage (id) {
        id -> Varchar,
        name -> Text,
        access_key_id -> Text,
        secret_access_key -> Text,
        bucket -> Text,
        region -> Text,
        path -> Nullable<Text>,
        endpoint -> Nullable<Text>,
        public_url -> Nullable<Text>,
        owner -> Varchar,
    }
}

diesel::table! {
    tag (id) {
        id -> Varchar,
        parent -> Nullable<Varchar>,
        name -> Text,
        catalog -> Varchar,
    }
}

diesel::table! {
    user (email) {
        email -> Text,
        password -> Nullable<Varchar>,
        fullname -> Nullable<Text>,
        administrator -> Bool,
        created -> Timestamptz,
        last_login -> Nullable<Timestamptz>,
        verified -> Nullable<Bool>,
    }
}

diesel::table! {
    user_catalog (user, catalog) {
        user -> Varchar,
        catalog -> Varchar,
        writable -> Bool,
    }
}

diesel::table! {
    album_descendent (id, descendent) {
        id -> Varchar,
        descendent -> Varchar,
    }
}

diesel::table! {
    tag_descendent (id, descendent) {
        id -> Varchar,
        descendent -> Varchar,
    }
}

diesel::table! {
    album_relation (media) {
        media -> Varchar,
        albums -> Json
    }
}

diesel::table! {
    tag_relation (media) {
        media -> Varchar,
        tags -> Json
    }
}

diesel::table! {
    person_relation (media) {
        media -> Varchar,
        people -> Json
    }
}

diesel::allow_columns_to_appear_in_same_group_by_clause!(
    media_item::id,
    media_item::deleted,
    media_item::created,
    media_item::updated,
    media_item::filename,
    media_item::title,
    media_item::description,
    media_item::label,
    media_item::category,
    media_item::location,
    media_item::city,
    media_item::state,
    media_item::country,
    media_item::make,
    media_item::model,
    media_item::lens,
    media_item::photographer,
    media_item::shutter_speed,
    media_item::taken_zone,
    media_item::orientation,
    media_item::iso,
    media_item::rating,
    media_item::longitude,
    media_item::latitude,
    media_item::altitude,
    media_item::aperture,
    media_item::focal_length,
    media_item::taken,
    media_item::catalog,
    media_item::media_file,
    media_item::datetime,
    media_file::id,
    media_file::uploaded,
    media_file::process_version,
    media_file::file_name,
    media_file::file_size,
    media_file::mimetype,
    media_file::width,
    media_file::height,
    media_file::duration,
    media_file::frame_rate,
    media_file::bit_rate,
    media_file::filename,
    media_file::title,
    media_file::description,
    media_file::label,
    media_file::category,
    media_file::location,
    media_file::city,
    media_file::state,
    media_file::country,
    media_file::make,
    media_file::model,
    media_file::lens,
    media_file::photographer,
    media_file::shutter_speed,
    media_file::taken_zone,
    media_file::orientation,
    media_file::iso,
    media_file::rating,
    media_file::longitude,
    media_file::latitude,
    media_file::altitude,
    media_file::aperture,
    media_file::focal_length,
    media_file::taken,
    media_file::media
);

diesel::allow_tables_to_appear_in_same_query!(
    album,
    alternate_file,
    catalog,
    media_album,
    media_file,
    media_item,
    media_person,
    media_search,
    media_tag,
    person,
    saved_search,
    shared_catalog,
    user_catalog,
    album_descendent,
    tag_descendent,
    album_relation,
    tag_relation,
    person_relation,
    storage,
    tag,
    user,
);
