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

diesel::joinable!(catalog -> storage (storage));
diesel::joinable!(media_person -> person (catalog));

diesel::allow_tables_to_appear_in_same_query!(
    album,
    alternate_file,
    catalog,
    media_album,
    media_file,
    media_item,
    media_person,
    media_tag,
    person,
    saved_search,
    shared_catalog,
    storage,
    tag,
    user,
);
