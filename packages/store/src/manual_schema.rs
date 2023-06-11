use crate::schema::{
    album, catalog, media_album, media_file, media_item, person, saved_search, tag,
};

diesel::table! {
    user_catalog (user, catalog) {
        user -> Varchar,
        catalog -> Varchar,
        writable -> Bool,
    }
}

diesel::allow_tables_to_appear_in_same_query!(user_catalog, catalog);
diesel::allow_tables_to_appear_in_same_query!(user_catalog, person);
diesel::allow_tables_to_appear_in_same_query!(user_catalog, album);
diesel::allow_tables_to_appear_in_same_query!(user_catalog, tag);
diesel::allow_tables_to_appear_in_same_query!(user_catalog, saved_search);
diesel::allow_tables_to_appear_in_same_query!(user_catalog, media_item);
diesel::allow_tables_to_appear_in_same_query!(user_catalog, media_file);
diesel::allow_tables_to_appear_in_same_query!(user_catalog, media_album);
