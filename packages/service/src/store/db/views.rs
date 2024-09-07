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

diesel::table! {
    search_relation (media) {
        media -> Varchar,
        searches -> Json
    }
}

diesel::table! {
    media_file_alternates (media_file) {
        media_file -> Varchar,
        alternates -> Json
    }
}

diesel::table! {
    latest_media_file (id) {
        id -> Varchar,
        uploaded -> Timestamptz,
        file_name -> Text,
        file_size -> Int8,
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
        orientation -> Nullable<Int4>,
        iso -> Nullable<Int4>,
        rating -> Nullable<Int4>,
        longitude -> Nullable<Float4>,
        latitude -> Nullable<Float4>,
        altitude -> Nullable<Float4>,
        aperture -> Nullable<Float4>,
        focal_length -> Nullable<Float4>,
        taken -> Nullable<Timestamp>,
        media_item -> Varchar,
        shutter_speed -> Nullable<Float4>,
        needs_metadata -> Bool,
        stored -> Nullable<Timestamptz>,
    }
}
