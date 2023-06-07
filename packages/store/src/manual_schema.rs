use crate::schema::catalog;

diesel::table! {
    user_catalog (user, catalog) {
        user -> Varchar,
        catalog -> Varchar,
        writable -> Bool,
    }
}

diesel::allow_tables_to_appear_in_same_query!(user_catalog, catalog);
