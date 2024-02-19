use std::{cmp::min, collections::HashMap, result};

use chrono::{DateTime, NaiveDateTime, Timelike, Utc};
use diesel::{
    backend, delete, deserialize, dsl::count, insert_into, pg::Pg, prelude::*, serialize,
    sql_types, upsert::excluded, AsExpression, Queryable,
};
use diesel_async::RunQueryDsl;
use mime::Mime;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{from_value, Value};
use serde_repr::Serialize_repr;
use tracing::{instrument, warn};
use typeshare::typeshare;

use crate::{
    metadata::{lookup_timezone, media_datetime},
    shared::{long_id, mime::MimeField, short_id},
    store::{
        aws::AwsClient,
        db::{
            self,
            functions::{
                lower, media_file_columns, media_item_columns, media_view, media_view_columns,
            },
            schema::*,
            search::{CompoundQueryItem, FilterGen},
        },
        path::{FilePath, MediaFilePath, MediaItemPath},
        DbConnection,
    },
    Error, FileStore, Result,
};

struct Batch<'a, T> {
    slice: &'a [T],
    pos: usize,
    count: usize,
}

impl<'a, T> Iterator for Batch<'a, T> {
    type Item = &'a [T];

    fn next(&mut self) -> Option<Self::Item> {
        if self.pos >= self.slice.len() {
            None
        } else {
            let end = min(self.slice.len(), self.pos + self.count);
            let next = &self.slice[self.pos..end];
            self.pos = end;
            Some(next)
        }
    }
}

fn batch<T>(slice: &[T], count: usize) -> Batch<T> {
    Batch {
        slice,
        pos: 0,
        count,
    }
}

struct OwnedBatch<T> {
    collection: Option<Vec<T>>,
    count: usize,
}

impl<T> Iterator for OwnedBatch<T> {
    type Item = Vec<T>;

    fn next(&mut self) -> Option<Self::Item> {
        if let Some(mut collection) = self.collection.take() {
            if collection.len() > self.count {
                self.collection = Some(collection.split_off(self.count));
            }

            Some(collection)
        } else {
            None
        }
    }
}

fn owned_batch<T>(collection: Vec<T>, count: usize) -> OwnedBatch<T> {
    OwnedBatch {
        collection: Some(collection),
        count,
    }
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, AsExpression, deserialize::FromSqlRow, Deserialize, Serialize,
)]
#[diesel(sql_type = sql_types::VarChar)]
#[serde(rename_all = "camelCase")]
pub enum AlternateFileType {
    Thumbnail,
    Reencode,
}

impl<DB> deserialize::FromSql<sql_types::VarChar, DB> for AlternateFileType
where
    DB: backend::Backend,
    String: deserialize::FromSql<sql_types::VarChar, DB>,
{
    fn from_sql(bytes: DB::RawValue<'_>) -> deserialize::Result<Self> {
        match String::from_sql(bytes)?.as_str() {
            "thumbnail" => Ok(AlternateFileType::Thumbnail),
            "reencode" => Ok(AlternateFileType::Reencode),
            x => Err(format!("Unrecognized variant {}", x).into()),
        }
    }
}

impl serialize::ToSql<sql_types::VarChar, diesel::pg::Pg> for AlternateFileType
where
    String: serialize::ToSql<sql_types::VarChar, diesel::pg::Pg>,
{
    fn to_sql<'b>(
        &'b self,
        out: &mut serialize::Output<'b, '_, diesel::pg::Pg>,
    ) -> serialize::Result {
        let string = match self {
            AlternateFileType::Thumbnail => "thumbnail".to_string(),
            AlternateFileType::Reencode => "reencode".to_string(),
        };

        <String as serialize::ToSql<sql_types::VarChar, diesel::pg::Pg>>::to_sql(
            &string,
            &mut out.reborrow(),
        )
    }
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, Serialize_repr, AsExpression, deserialize::FromSqlRow)]
#[diesel(sql_type = sql_types::Int4)]
pub enum Orientation {
    TopLeft = 1,
    TopRight = 2,
    BottomRight = 3,
    BottomLeft = 4,
    LeftTop = 5,
    RightTop = 6,
    RightBottom = 7,
    LeftBottom = 8,
}

impl<DB> deserialize::FromSql<sql_types::Int4, DB> for Orientation
where
    DB: backend::Backend,
    i32: deserialize::FromSql<sql_types::Int4, DB>,
{
    fn from_sql(bytes: DB::RawValue<'_>) -> deserialize::Result<Self> {
        match i32::from_sql(bytes)? {
            1 => Ok(Orientation::TopLeft),
            2 => Ok(Orientation::TopRight),
            3 => Ok(Orientation::BottomRight),
            4 => Ok(Orientation::BottomLeft),
            5 => Ok(Orientation::LeftTop),
            6 => Ok(Orientation::RightTop),
            7 => Ok(Orientation::RightBottom),
            8 => Ok(Orientation::LeftBottom),
            x => Err(format!("Unrecognized variant {}", x).into()),
        }
    }
}

impl<DB> serialize::ToSql<sql_types::Int4, DB> for Orientation
where
    DB: backend::Backend,
    i32: serialize::ToSql<sql_types::Int4, DB>,
{
    fn to_sql<'b>(&'b self, out: &mut serialize::Output<'b, '_, DB>) -> serialize::Result {
        match self {
            Orientation::TopLeft => 1.to_sql(out),
            Orientation::TopRight => 2.to_sql(out),
            Orientation::BottomRight => 3.to_sql(out),
            Orientation::BottomLeft => 4.to_sql(out),
            Orientation::LeftTop => 5.to_sql(out),
            Orientation::RightTop => 6.to_sql(out),
            Orientation::RightBottom => 7.to_sql(out),
            Orientation::LeftBottom => 8.to_sql(out),
        }
    }
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub(crate) struct User {
    pub(crate) email: String,
    #[serde(skip)]
    pub(crate) password: Option<String>,
    pub(crate) fullname: Option<String>,
    pub(crate) administrator: bool,
    #[typeshare(serialized_as = "string")]
    pub(crate) created: DateTime<Utc>,
    #[typeshare(serialized_as = "string")]
    pub(crate) last_login: Option<DateTime<Utc>>,
    pub(crate) verified: Option<bool>,
}

impl User {
    pub(crate) async fn get(conn: &mut DbConnection<'_>, email: &str) -> Result<User> {
        user::table
            .filter(user::email.eq(email))
            .select(user::all_columns)
            .get_result::<User>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub(crate) struct Storage {
    pub(crate) id: String,
    pub(crate) name: String,
    #[serde(skip)]
    pub(crate) access_key_id: String,
    #[serde(skip)]
    pub(crate) secret_access_key: String,
    pub(crate) bucket: String,
    pub(crate) region: String,
    pub(crate) path: Option<String>,
    pub(crate) endpoint: Option<String>,
    pub(crate) public_url: Option<String>,
    #[serde(skip)]
    pub(crate) _owner: String,
}

impl Storage {
    pub(crate) async fn file_store(&self) -> Result<impl FileStore> {
        let client = AwsClient::from_storage(self).await?;

        Ok(client)
    }

    pub(crate) async fn online_uri(
        &self,
        path: &FilePath,
        mimetype: &Mime,
        filename: Option<&str>,
    ) -> Result<String> {
        let client = AwsClient::from_storage(self).await?;
        client.file_uri(path, mimetype, filename).await
    }

    pub(crate) async fn get_for_catalog(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Storage> {
        storage::table
            .inner_join(catalog::table.on(catalog::storage.eq(storage::id)))
            .filter(catalog::id.eq(catalog))
            .select(storage::all_columns)
            .get_result::<Storage>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub(crate) async fn list_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
    ) -> Result<Vec<Storage>> {
        Ok(storage::table
            .filter(storage::owner.eq(email))
            .select(storage::all_columns)
            .load::<Storage>(conn)
            .await?)
    }
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub(crate) struct Catalog {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) storage: String,
}

impl Catalog {
    #[instrument(skip(self, conn), fields(catalog = self.id))]
    pub(crate) async fn list_media(
        &self,
        conn: &mut DbConnection<'_>,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<MediaView>> {
        let mut query = media_view!()
            .filter(media_item::catalog.eq(&self.id))
            .select(media_view_columns!())
            .offset(offset.unwrap_or_default())
            .into_boxed();

        if let Some(count) = count {
            query = query.limit(count);
        }

        Ok(query.load::<MediaView>(conn).await?)
    }

    pub(crate) async fn list(conn: &mut DbConnection<'_>) -> Result<Vec<Catalog>> {
        Ok(catalog::table
            .select(catalog::all_columns)
            .load::<Catalog>(conn)
            .await?)
    }

    pub(crate) async fn list_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
    ) -> Result<Vec<Catalog>> {
        Ok(catalog::table
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(catalog::id)))
            .filter(user_catalog::user.eq(email))
            .select(catalog::all_columns)
            .order(catalog::name.asc())
            .load::<Catalog>(conn)
            .await?)
    }

    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        catalog: &str,
    ) -> Result<Catalog> {
        user_catalog::table
            .inner_join(catalog::table.on(catalog::id.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(catalog::id.eq(catalog))
            .select(catalog::all_columns)
            .get_result::<Catalog>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub(crate) async fn get_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: &str,
        catalog: &str,
    ) -> Result<(Catalog, i64)> {
        user_catalog::table
            .inner_join(catalog::table.on(catalog::id.eq(user_catalog::catalog)))
            .left_join(media_item::table.on(catalog::id.eq(media_item::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(catalog::id.eq(catalog))
            .group_by(catalog::id)
            .select((catalog::all_columns, count(media_item::id.nullable())))
            .get_result::<(Catalog, i64)>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }
}

#[typeshare]
#[derive(Queryable, Insertable, Serialize, Clone, Debug)]
#[diesel(table_name = person)]
pub(crate) struct Person {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) catalog: String,
}

impl Person {
    pub(crate) async fn list_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
    ) -> Result<Vec<Person>> {
        Ok(user_catalog::table
            .inner_join(person::table.on(person::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(person::all_columns)
            .order(person::name.asc())
            .load::<Person>(conn)
            .await?)
    }

    #[instrument(skip(conn))]
    pub(crate) async fn get_or_create(
        conn: &mut DbConnection<'_>,
        catalog: &str,
        name: &str,
    ) -> Result<Person> {
        conn.assert_in_transaction();

        let person = match person::table
            .filter(person::catalog.eq(catalog))
            .filter(lower(person::name).eq(&name.to_lowercase()))
            .select(person::all_columns)
            .get_result::<Person>(conn)
            .await
            .optional()?
        {
            Some(p) => p,
            None => {
                let new_person = Person {
                    id: short_id("P"),
                    name: name.to_owned(),
                    catalog: catalog.to_owned(),
                };

                insert_into(person::table)
                    .values(&new_person)
                    .execute(conn)
                    .await?;

                new_person
            }
        };

        Ok(person)
    }
}

#[derive(Queryable, Insertable, Serialize, Clone, Debug)]
#[diesel(table_name = media_person)]
pub(crate) struct MediaPerson {
    pub(crate) catalog: String,
    pub(crate) media: String,
    pub(crate) person: String,
    pub(crate) location: Option<Location>,
}

impl MediaPerson {
    #[instrument(skip_all)]
    pub(crate) async fn replace_for_media(
        conn: &mut DbConnection<'_>,
        media: &str,
        people: &[MediaPerson],
    ) -> Result {
        MediaPerson::upsert(conn, people).await?;

        let people_ids: Vec<&String> = people.iter().map(|p| &p.person).collect();

        diesel::delete(media_person::table)
            .filter(media_person::media.eq(media))
            .filter(media_person::person.ne_all(people_ids))
            .execute(conn)
            .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, people: &[MediaPerson]) -> Result {
        for records in batch(people, 500) {
            diesel::insert_into(media_person::table)
                .values(records)
                .on_conflict((media_person::media, media_person::person))
                .do_update()
                .set((media_person::location.eq(excluded(media_person::location)),))
                .execute(conn)
                .await?;
        }

        Ok(())
    }
}

#[typeshare]
#[derive(Queryable, Insertable, Serialize, Clone, Debug)]
#[diesel(table_name = tag)]
pub(crate) struct Tag {
    pub(crate) id: String,
    pub(crate) parent: Option<String>,
    pub(crate) name: String,
    pub(crate) catalog: String,
}

impl Tag {
    pub(crate) async fn list_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
    ) -> Result<Vec<Tag>> {
        Ok(user_catalog::table
            .inner_join(tag::table.on(tag::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .select(tag::all_columns)
            .order(tag::name.asc())
            .load::<Tag>(conn)
            .await?)
    }

    #[instrument(skip(conn))]
    pub(crate) async fn get_or_create(
        conn: &mut DbConnection<'_>,
        catalog: &str,
        hierarchy: &[String],
    ) -> Result<Tag> {
        conn.assert_in_transaction();

        assert!(!hierarchy.is_empty());

        let mut current_tag = match tag::table
            .filter(tag::catalog.eq(catalog))
            .filter(lower(tag::name).eq(&hierarchy[0].to_lowercase()))
            .select(tag::all_columns)
            .get_result::<Tag>(conn)
            .await
            .optional()?
        {
            Some(t) => t,
            None => {
                let new_tag = Tag {
                    id: short_id("T"),
                    parent: None,
                    name: hierarchy[0].clone(),
                    catalog: catalog.to_owned(),
                };

                insert_into(tag::table)
                    .values(&new_tag)
                    .execute(conn)
                    .await?;

                new_tag
            }
        };

        let i = 1;
        while i < hierarchy.len() {
            current_tag = match tag::table
                .filter(tag::catalog.eq(catalog))
                .filter(tag::parent.eq(&current_tag.id))
                .filter(lower(tag::name).eq(&hierarchy[i].to_lowercase()))
                .select(tag::all_columns)
                .get_result::<Tag>(conn)
                .await
                .optional()?
            {
                Some(t) => t,
                None => {
                    let new_tag = Tag {
                        id: short_id("T"),
                        parent: Some(current_tag.id.clone()),
                        name: hierarchy[i].clone(),
                        catalog: catalog.to_owned(),
                    };

                    insert_into(tag::table)
                        .values(&new_tag)
                        .execute(conn)
                        .await?;

                    new_tag
                }
            }
        }

        Ok(current_tag)
    }
}

#[derive(Queryable, Insertable, Serialize, Clone, Debug)]
#[diesel(table_name = media_album)]
pub(crate) struct MediaAlbum {
    pub(crate) catalog: String,
    pub(crate) media: String,
    pub(crate) album: String,
}

impl MediaAlbum {
    #[instrument(skip_all)]
    pub(crate) async fn remove_media(
        conn: &mut DbConnection<'_>,
        album: &str,
        media: &[String],
    ) -> Result {
        diesel::delete(media_album::table)
            .filter(media_album::album.eq(album))
            .filter(media_album::media.eq_any(media))
            .execute(conn)
            .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn replace_for_media(
        conn: &mut DbConnection<'_>,
        media: &str,
        albums: &[MediaAlbum],
    ) -> Result {
        MediaAlbum::upsert(conn, albums).await?;

        let album_ids: Vec<&String> = albums.iter().map(|a| &a.album).collect();

        diesel::delete(media_album::table)
            .filter(media_album::media.eq(media))
            .filter(media_album::album.ne_all(album_ids))
            .execute(conn)
            .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, albums: &[MediaAlbum]) -> Result {
        for records in batch(albums, 500) {
            diesel::insert_into(media_album::table)
                .values(records)
                .on_conflict_do_nothing()
                .execute(conn)
                .await?;
        }

        Ok(())
    }
}

#[typeshare]
#[derive(Queryable, Insertable, Serialize, Clone, Debug)]
#[diesel(table_name = album)]
pub(crate) struct Album {
    pub(crate) id: String,
    pub(crate) parent: Option<String>,
    pub(crate) name: String,
    pub(crate) catalog: String,
}

impl Album {
    #[instrument(skip(self, conn), fields(album = self.id))]
    pub(crate) async fn list_media(
        &self,
        conn: &mut DbConnection<'_>,
        recursive: bool,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<MediaView>> {
        if recursive {
            let valid_ids = media_album::table
                .inner_join(
                    album_descendent::table.on(album_descendent::descendent.eq(media_album::album)),
                )
                .filter(album_descendent::id.eq(&self.id))
                .select(media_album::media);

            let mut query = media_view!()
                .filter(media_item::id.eq_any(valid_ids))
                .select(media_view_columns!())
                .offset(offset.unwrap_or_default())
                .into_boxed();

            if let Some(count) = count {
                query = query.limit(count);
            }

            Ok(query.load::<MediaView>(conn).await?)
        } else {
            let valid_ids = media_album::table
                .filter(media_album::album.eq(&self.id))
                .select(media_album::media);

            let mut query = media_view!()
                .filter(media_item::id.eq_any(valid_ids))
                .select(media_view_columns!())
                .offset(offset.unwrap_or_default())
                .into_boxed();

            if let Some(count) = count {
                query = query.limit(count);
            }

            Ok(query.load::<MediaView>(conn).await?)
        }
    }

    pub(crate) async fn list_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: &str,
    ) -> Result<Vec<(Album, i64)>> {
        Ok(user_catalog::table
            .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
            .left_join(media_album::table.on(media_album::album.eq(album::id)))
            .filter(user_catalog::user.eq(email))
            .group_by(album::id)
            .select((album::all_columns, count(media_album::media.nullable())))
            .order(album::name.asc())
            .load::<(Album, i64)>(conn)
            .await?)
    }

    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        id: &str,
    ) -> Result<Album> {
        user_catalog::table
            .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(album::id.eq(id))
            .select(album::all_columns)
            .get_result::<Album>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub(crate) async fn get_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: &str,
        album: &str,
        recursive: bool,
    ) -> Result<(Album, i64)> {
        if recursive {
            user_catalog::table
                .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
                .inner_join(album_descendent::table.on(album::id.eq(album_descendent::id)))
                .left_join(
                    media_album::table.on(album_descendent::descendent.eq(media_album::album)),
                )
                .filter(user_catalog::user.eq(email))
                .filter(album::id.eq(album))
                .group_by(album::id)
                .select((album::all_columns, count(media_album::media.nullable())))
                .get_result::<(Album, i64)>(conn)
                .await
                .optional()?
                .ok_or_else(|| Error::NotFound)
        } else {
            user_catalog::table
                .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
                .left_join(media_album::table.on(album::id.eq(media_album::album)))
                .filter(user_catalog::user.eq(email))
                .filter(album::id.eq(album))
                .group_by(album::id)
                .select((album::all_columns, count(media_album::media.nullable())))
                .get_result::<(Album, i64)>(conn)
                .await
                .optional()?
                .ok_or_else(|| Error::NotFound)
        }
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, albums: &[Album]) -> Result {
        for records in batch(albums, 500) {
            diesel::insert_into(album::table)
                .values(records)
                .on_conflict(album::id)
                .do_update()
                .set((
                    album::name.eq(excluded(album::name)),
                    album::parent.eq(excluded(album::parent)),
                ))
                .execute(conn)
                .await?;
        }

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn delete(conn: &mut DbConnection<'_>, albums: &[String]) -> Result {
        diesel::delete(album::table)
            .filter(album::id.eq_any(albums))
            .execute(conn)
            .await?;

        Ok(())
    }
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub(crate) struct SavedSearch {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) shared: bool,
    pub(crate) query: CompoundQueryItem,
    pub(crate) catalog: String,
}

#[derive(Insertable)]
#[diesel(table_name = media_search)]
struct MediaSearch {
    catalog: String,
    media: String,
    search: String,
    added: DateTime<Utc>,
}

impl SavedSearch {
    #[instrument(skip(self, conn), fields(search = self.id))]
    pub(crate) async fn list_media(
        &self,
        conn: &mut DbConnection<'_>,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<MediaView>> {
        let valid_ids = media_search::table
            .filter(media_search::search.eq(&self.id))
            .select(media_search::media);

        let mut query = media_view!()
            .filter(media_item::id.eq_any(valid_ids))
            .select(media_view_columns!())
            .offset(offset.unwrap_or_default())
            .into_boxed();

        if let Some(count) = count {
            query = query.limit(count);
        }

        Ok(query.load::<MediaView>(conn).await?)
    }

    #[instrument(skip(self, conn), fields(search = self.id))]
    pub(crate) async fn update(&self, conn: &mut DbConnection<'_>) -> Result {
        let select = media_item::table
            .left_outer_join(
                media_file::table.on(media_item::media_file.eq(media_file::id.nullable())),
            )
            .filter(media_item::catalog.eq(&self.catalog))
            .filter(self.query.filter_gen(&self.catalog))
            .select(media_item::id)
            .distinct();

        let matching_media = select.load::<String>(conn).await?;

        let now = Utc::now();

        let inserts: Vec<MediaSearch> = matching_media
            .iter()
            .map(|id| MediaSearch {
                catalog: self.catalog.clone(),
                media: id.to_owned(),
                search: self.id.to_string(),
                added: now,
            })
            .collect();

        insert_into(media_search::table)
            .values(inserts)
            .on_conflict_do_nothing()
            .execute(conn)
            .await?;

        delete(
            media_search::table
                .filter(media_search::search.eq(&self.id))
                .filter(media_search::media.ne_all(matching_media)),
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    pub(crate) async fn update_for_catalog(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
        let searches = saved_search::table
            .filter(saved_search::catalog.eq(catalog))
            .select(saved_search::all_columns)
            .load::<SavedSearch>(conn)
            .await?;

        for search in searches {
            search.update(conn).await?;
        }

        Ok(())
    }

    pub(crate) async fn get_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: &str,
        search: &str,
    ) -> Result<(SavedSearch, i64)> {
        user_catalog::table
            .inner_join(saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)))
            .left_join(media_search::table.on(saved_search::id.eq(media_search::search)))
            .filter(user_catalog::user.eq(email))
            .filter(saved_search::id.eq(search))
            .group_by(saved_search::id)
            .select((
                saved_search::all_columns,
                count(media_search::media.nullable()),
            ))
            .get_result::<(SavedSearch, i64)>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)
    }

    pub(crate) async fn list_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: &str,
    ) -> Result<Vec<(SavedSearch, i64)>> {
        Ok(user_catalog::table
            .inner_join(saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)))
            .left_join(media_search::table.on(media_search::search.eq(saved_search::id)))
            .filter(user_catalog::user.eq(email))
            .group_by(saved_search::id)
            .select((
                saved_search::all_columns,
                count(media_search::media.nullable()),
            ))
            .order(saved_search::name.asc())
            .load::<(SavedSearch, i64)>(conn)
            .await?)
    }
}

fn clear_matching<T: PartialEq>(field: &mut Option<T>, reference: &Option<T>) {
    if field == reference {
        *field = None;
    }
}

#[derive(Insertable, Clone, Debug)]
#[diesel(table_name = media_tag)]
pub(crate) struct MediaTag {
    pub(crate) catalog: String,
    pub(crate) media: String,
    pub(crate) tag: String,
}

impl MediaTag {
    #[instrument(skip_all)]
    pub(crate) async fn replace_for_media(
        conn: &mut DbConnection<'_>,
        media: &str,
        tags: &[MediaTag],
    ) -> Result {
        MediaTag::upsert(conn, tags).await?;

        let tag_ids: Vec<&String> = tags.iter().map(|t| &t.tag).collect();

        diesel::delete(media_tag::table)
            .filter(media_tag::media.eq(media))
            .filter(media_tag::tag.ne_all(tag_ids))
            .execute(conn)
            .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, tags: &[MediaTag]) -> Result {
        for records in batch(tags, 500) {
            diesel::insert_into(media_tag::table)
                .values(records)
                .on_conflict_do_nothing()
                .execute(conn)
                .await?;
        }

        Ok(())
    }
}

#[derive(Insertable, Serialize, PartialEq, Default, Clone, Debug)]
#[diesel(table_name = media_item, table_name = media_file)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub filename: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub label: Option<String>,
    pub category: Option<String>,
    pub location: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens: Option<String>,
    pub photographer: Option<String>,
    pub shutter_speed: Option<f32>,
    pub orientation: Option<i32>,
    pub iso: Option<i32>,
    pub rating: Option<i32>,
    pub longitude: Option<f32>,
    pub latitude: Option<f32>,
    pub altitude: Option<f32>,
    pub aperture: Option<f32>,
    pub focal_length: Option<f32>,
    pub taken: Option<NaiveDateTime>,
}

impl MediaMetadata {
    fn clear_matching(&mut self, media_file: &MediaMetadata) {
        clear_matching(&mut self.filename, &media_file.filename);
        clear_matching(&mut self.title, &media_file.title);
        clear_matching(&mut self.description, &media_file.description);
        clear_matching(&mut self.label, &media_file.label);
        clear_matching(&mut self.category, &media_file.category);
        clear_matching(&mut self.location, &media_file.location);
        clear_matching(&mut self.city, &media_file.city);
        clear_matching(&mut self.state, &media_file.state);
        clear_matching(&mut self.country, &media_file.country);
        clear_matching(&mut self.make, &media_file.make);
        clear_matching(&mut self.model, &media_file.model);
        clear_matching(&mut self.lens, &media_file.lens);
        clear_matching(&mut self.photographer, &media_file.photographer);
        clear_matching(&mut self.shutter_speed, &media_file.shutter_speed);
        clear_matching(&mut self.orientation, &media_file.orientation);
        clear_matching(&mut self.iso, &media_file.iso);
        clear_matching(&mut self.rating, &media_file.rating);
        clear_matching(&mut self.longitude, &media_file.longitude);
        clear_matching(&mut self.latitude, &media_file.latitude);
        clear_matching(&mut self.altitude, &media_file.altitude);
        clear_matching(&mut self.aperture, &media_file.aperture);
        clear_matching(&mut self.focal_length, &media_file.focal_length);

        // Ignore any sub-second differences.
        if let (Some(item_taken), Some(file_taken)) = (self.taken, media_file.taken) {
            if item_taken.with_nanosecond(0) == file_taken.with_nanosecond(0) {
                self.taken = None;
            }
        }
    }
}

type MediaMetadataRow = (
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Text>,
    sql_types::Nullable<sql_types::Float>,
    sql_types::Nullable<sql_types::Integer>,
    sql_types::Nullable<sql_types::Integer>,
    sql_types::Nullable<sql_types::Integer>,
    sql_types::Nullable<sql_types::Float>,
    sql_types::Nullable<sql_types::Float>,
    sql_types::Nullable<sql_types::Float>,
    sql_types::Nullable<sql_types::Float>,
    sql_types::Nullable<sql_types::Float>,
    sql_types::Nullable<sql_types::Timestamp>,
);

impl Queryable<MediaMetadataRow, Pg> for MediaMetadata {
    type Row = (
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<f32>,
        Option<i32>,
        Option<i32>,
        Option<i32>,
        Option<f32>,
        Option<f32>,
        Option<f32>,
        Option<f32>,
        Option<f32>,
        Option<NaiveDateTime>,
    );

    fn build(row: Self::Row) -> deserialize::Result<Self> {
        Ok(MediaMetadata {
            filename: row.0,
            title: row.1,
            description: row.2,
            label: row.3,
            category: row.4,
            location: row.5,
            city: row.6,
            state: row.7,
            country: row.8,
            make: row.9,
            model: row.10,
            lens: row.11,
            photographer: row.12,
            shutter_speed: row.13,
            orientation: row.14,
            iso: row.15,
            rating: row.16,
            longitude: row.17,
            latitude: row.18,
            altitude: row.19,
            aperture: row.20,
            focal_length: row.21,
            taken: row.22,
        })
    }
}

#[derive(Queryable, Insertable, Clone, Debug)]
#[diesel(table_name = media_item)]
pub struct MediaItem {
    pub id: String,
    pub deleted: bool,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    #[diesel(embed)]
    pub metadata: MediaMetadata,
    pub taken_zone: Option<String>,
    pub catalog: String,
    pub media_file: Option<String>,
    pub datetime: DateTime<Utc>,
}

impl MediaItem {
    pub fn new(catalog: &str) -> Self {
        let now = Utc::now();

        Self {
            id: long_id("M"),
            deleted: false,
            created: now,
            updated: now,
            metadata: MediaMetadata::default(),
            taken_zone: None,
            catalog: catalog.to_owned(),
            media_file: None,
            datetime: now,
        }
    }

    pub(crate) async fn get(
        conn: &mut DbConnection<'_>,
        media: &[String],
    ) -> Result<Vec<MediaItem>> {
        let media = media_item::table
            .filter(media_item::id.eq_any(media))
            .select(media_item_columns!())
            .load::<MediaItem>(conn)
            .await?;

        Ok(media)
    }

    pub(crate) async fn list_deleted(conn: &mut DbConnection<'_>) -> Result<Vec<MediaItem>> {
        let media = media_item::table
            .filter(media_item::deleted.eq(true))
            .select(media_item_columns!())
            .load::<MediaItem>(conn)
            .await?;

        Ok(media)
    }

    pub(crate) async fn delete(conn: &mut DbConnection<'_>, media: &[String]) -> Result {
        diesel::delete(media_item::table)
            .filter(media_item::id.eq_any(media))
            .execute(conn)
            .await?;

        Ok(())
    }

    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        ids: &[String],
    ) -> Result<Vec<Self>> {
        Ok(media_item::table
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(media_item::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(media_item::id.eq_any(ids))
            .select(media_item_columns!())
            .load::<Self>(conn)
            .await?)
    }

    pub(crate) async fn update_media_files(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
        let items = media_item::table
            .left_outer_join(media_file::table.on(media_item::id.eq(media_file::media_item)))
            .filter(media_file::process_version.gt(0))
            .filter(media_item::catalog.eq(catalog))
            .order_by((media_item::id, media_file::uploaded.desc()))
            .distinct_on(media_item::id)
            .select((media_item_columns!(), media_file_columns!().nullable()))
            .load::<(MediaItem, Option<MediaFile>)>(conn)
            .await?;

        let updated: Vec<MediaItem> = items
            .into_iter()
            .filter_map(|(mut item, file)| {
                if item.media_file.as_ref() == file.as_ref().map(|f| &f.id) {
                    None
                } else {
                    item.sync_with_file(file.as_ref());
                    Some(item)
                }
            })
            .collect();

        Self::upsert(conn, &updated).await
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, media_items: &[MediaItem]) -> Result {
        for records in batch(media_items, 500) {
            diesel::insert_into(media_item::table)
                .values(records)
                .on_conflict(media_item::id)
                .do_update()
                .set((
                    media_item::deleted.eq(excluded(media_item::deleted)),
                    media_item::created.eq(excluded(media_item::created)),
                    media_item::updated.eq(excluded(media_item::updated)),
                    media_item::datetime.eq(excluded(media_item::datetime)),
                    media_item::filename.eq(excluded(media_item::filename)),
                    media_item::title.eq(excluded(media_item::title)),
                    media_item::description.eq(excluded(media_item::description)),
                    media_item::label.eq(excluded(media_item::label)),
                    media_item::category.eq(excluded(media_item::category)),
                    media_item::location.eq(excluded(media_item::location)),
                    media_item::city.eq(excluded(media_item::city)),
                    media_item::state.eq(excluded(media_item::state)),
                    media_item::country.eq(excluded(media_item::country)),
                    media_item::make.eq(excluded(media_item::make)),
                    media_item::model.eq(excluded(media_item::model)),
                    media_item::lens.eq(excluded(media_item::lens)),
                    media_item::photographer.eq(excluded(media_item::photographer)),
                    media_item::shutter_speed.eq(excluded(media_item::shutter_speed)),
                    media_item::taken_zone.eq(excluded(media_item::taken_zone)),
                    media_item::orientation.eq(excluded(media_item::orientation)),
                    media_item::iso.eq(excluded(media_item::iso)),
                    media_item::rating.eq(excluded(media_item::rating)),
                    media_item::longitude.eq(excluded(media_item::longitude)),
                    media_item::latitude.eq(excluded(media_item::latitude)),
                    media_item::altitude.eq(excluded(media_item::altitude)),
                    media_item::aperture.eq(excluded(media_item::aperture)),
                    media_item::focal_length.eq(excluded(media_item::focal_length)),
                    media_item::taken.eq(excluded(media_item::taken)),
                    media_item::media_file.eq(excluded(media_item::media_file)),
                ))
                .execute(conn)
                .await?;
        }

        Ok(())
    }

    pub(crate) async fn list_unprocessed(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<MediaItem>> {
        let items = media_item::table
            .filter(media_item::media_file.is_null())
            .filter(media_item::catalog.eq(catalog))
            .select(media_item_columns!())
            .load::<MediaItem>(conn)
            .await?;

        Ok(items)
    }

    pub(crate) fn sync_with_file(&mut self, media_file: Option<&MediaFile>) {
        if let Some(media_file) = media_file {
            self.media_file = Some(media_file.id.clone());
            self.metadata.clear_matching(&media_file.metadata);
        } else {
            self.media_file = None;
        }

        match (
            self.metadata
                .longitude
                .or(media_file.and_then(|f| f.metadata.longitude)),
            self.metadata
                .latitude
                .or(media_file.and_then(|f| f.metadata.latitude)),
        ) {
            (Some(longitude), Some(latitude)) => {
                self.taken_zone = lookup_timezone(longitude, latitude)
            }
            _ => self.taken_zone = None,
        }

        self.datetime = media_datetime(self, media_file);
    }

    pub(crate) fn path(&self) -> MediaItemPath {
        MediaItemPath {
            catalog: self.catalog.clone(),
            item: self.id.clone(),
        }
    }
}

#[derive(Queryable, Insertable, Clone, Debug)]
#[diesel(table_name = media_file)]
pub(crate) struct MediaFile {
    pub(crate) id: String,
    pub(crate) uploaded: DateTime<Utc>,
    pub(crate) process_version: i32,
    pub(crate) file_name: String,
    pub(crate) file_size: i32,
    #[diesel(deserialize_as = MimeField, serialize_as = MimeField)]
    pub(crate) mimetype: Mime,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) duration: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    #[diesel(embed)]
    pub(crate) metadata: MediaMetadata,
    pub(crate) media_item: String,
}

impl MediaFile {
    pub(crate) fn new(media_item: &str, file_name: &str, file_size: i32, mimetype: &Mime) -> Self {
        Self {
            id: short_id("I"),
            uploaded: Utc::now(),
            process_version: -1,
            file_name: file_name.to_owned(),
            file_size,
            mimetype: mimetype.to_owned(),
            width: 0,
            height: 0,
            duration: None,
            frame_rate: None,
            bit_rate: None,
            metadata: Default::default(),
            media_item: media_item.to_owned(),
        }
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_newest(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(MediaFile, MediaFilePath)>> {
        let files = media_file::table
            .inner_join(media_item::table.on(media_item::id.eq(media_file::media_item)))
            .filter(media_item::catalog.eq(catalog))
            .order_by((media_file::media_item, media_file::uploaded.desc()))
            .distinct_on(media_file::media_item)
            .select((media_file_columns!(), media_item::catalog))
            .load::<(MediaFile, String)>(conn)
            .await?;

        Ok(files
            .into_iter()
            .map(|(media_file, catalog)| {
                let media_path = MediaFilePath {
                    catalog,
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                };
                (media_file, media_path)
            })
            .collect())
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_prunable(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(MediaFile, MediaFilePath)>> {
        let files = media_file::table
            .inner_join(media_item::table.on(media_item::id.eq(media_file::media_item)))
            .filter(media_item::catalog.eq(catalog))
            .filter(media_item::media_file.is_not_null())
            .filter(media_item::media_file.ne(media_file::id.nullable()))
            .filter(media_file::process_version.gt(0))
            .select((media_file_columns!(), media_item::catalog))
            .load::<(MediaFile, String)>(conn)
            .await?;

        Ok(files
            .into_iter()
            .map(|(media_file, catalog)| {
                let media_path = MediaFilePath {
                    catalog,
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                };
                (media_file, media_path)
            })
            .collect())
    }

    pub(crate) async fn list_for_catalog(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(MediaFile, MediaFilePath)>> {
        let files = media_file::table
            .inner_join(media_item::table.on(media_file::media_item.eq(media_item::id)))
            .filter(media_item::catalog.eq(&catalog))
            .select(media_file_columns!())
            .load::<MediaFile>(conn)
            .await?;

        Ok(files
            .into_iter()
            .map(|media_file| {
                let file_path = MediaFilePath {
                    catalog: catalog.to_owned(),
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                };
                (media_file, file_path)
            })
            .collect())
    }

    pub(crate) async fn get_for_user_media(
        conn: &mut DbConnection<'_>,
        email: &str,
        media: &str,
        file: &str,
    ) -> Result<(MediaFile, MediaFilePath)> {
        let (media_file, catalog) = media_file::table
            .inner_join(media_item::table.on(media_item::id.eq(media_file::media_item)))
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(media_item::catalog)))
            .filter(user_catalog::user.eq(email))
            .filter(media_item::id.eq(media))
            .filter(media_file::id.eq(file))
            .select((media_file_columns!(), media_item::catalog))
            .get_result::<(MediaFile, String)>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)?;

        let file_path = MediaFilePath {
            catalog,
            item: media.to_owned(),
            file: file.to_owned(),
        };
        Ok((media_file, file_path))
    }

    pub(crate) async fn get(
        conn: &mut DbConnection<'_>,
        id: &str,
    ) -> Result<(MediaFile, MediaFilePath)> {
        let (media_file, catalog) = media_file::table
            .inner_join(media_item::table.on(media_item::id.eq(media_file::media_item)))
            .filter(media_file::id.eq(id))
            .select((media_file_columns!(), media_item::catalog))
            .get_result::<(MediaFile, String)>(conn)
            .await
            .optional()?
            .ok_or_else(|| Error::NotFound)?;

        let file_path = MediaFilePath {
            catalog,
            item: media_file.media_item.clone(),
            file: media_file.id.clone(),
        };

        Ok((media_file, file_path))
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, media_files: Vec<MediaFile>) -> Result {
        conn.assert_in_transaction();

        let media_file_map: HashMap<&String, &MediaFile> =
            media_files.iter().map(|m| (&m.id, m)).collect();
        let media_file_ids: Vec<&&String> = media_file_map.keys().collect();
        let mut items = media_item::table
            .filter(media_item::media_file.eq_any(media_file_ids))
            .select(media_item_columns!())
            .load::<MediaItem>(conn)
            .await?;

        items.iter_mut().for_each(|item| {
            if let Some(file) = item.media_file.as_ref().and_then(|f| media_file_map.get(f)) {
                item.sync_with_file(Some(file));
            }
        });

        for records in owned_batch(media_files, 500) {
            diesel::insert_into(media_file::table)
                .values(records)
                .on_conflict(media_file::id)
                .do_update()
                .set((
                    media_file::uploaded.eq(excluded(media_file::uploaded)),
                    media_file::process_version.eq(excluded(media_file::process_version)),
                    media_file::file_name.eq(excluded(media_file::file_name)),
                    media_file::file_size.eq(excluded(media_file::file_size)),
                    media_file::mimetype.eq(excluded(media_file::mimetype)),
                    media_file::width.eq(excluded(media_file::width)),
                    media_file::height.eq(excluded(media_file::height)),
                    media_file::duration.eq(excluded(media_file::duration)),
                    media_file::frame_rate.eq(excluded(media_file::frame_rate)),
                    media_file::bit_rate.eq(excluded(media_file::bit_rate)),
                    media_file::filename.eq(excluded(media_file::filename)),
                    media_file::title.eq(excluded(media_file::title)),
                    media_file::description.eq(excluded(media_file::description)),
                    media_file::label.eq(excluded(media_file::label)),
                    media_file::category.eq(excluded(media_file::category)),
                    media_file::location.eq(excluded(media_file::location)),
                    media_file::city.eq(excluded(media_file::city)),
                    media_file::state.eq(excluded(media_file::state)),
                    media_file::country.eq(excluded(media_file::country)),
                    media_file::make.eq(excluded(media_file::make)),
                    media_file::model.eq(excluded(media_file::model)),
                    media_file::lens.eq(excluded(media_file::lens)),
                    media_file::photographer.eq(excluded(media_file::photographer)),
                    media_file::shutter_speed.eq(excluded(media_file::shutter_speed)),
                    media_file::orientation.eq(excluded(media_file::orientation)),
                    media_file::iso.eq(excluded(media_file::iso)),
                    media_file::rating.eq(excluded(media_file::rating)),
                    media_file::longitude.eq(excluded(media_file::longitude)),
                    media_file::latitude.eq(excluded(media_file::latitude)),
                    media_file::altitude.eq(excluded(media_file::altitude)),
                    media_file::aperture.eq(excluded(media_file::aperture)),
                    media_file::focal_length.eq(excluded(media_file::focal_length)),
                    media_file::taken.eq(excluded(media_file::taken)),
                ))
                .execute(conn)
                .await?;
        }

        MediaItem::upsert(conn, &items).await?;

        Ok(())
    }

    pub(crate) async fn delete(
        &self,
        conn: &mut DbConnection<'_>,
        storage: &Storage,
        media_file_path: &MediaFilePath,
    ) -> Result {
        diesel::delete(media_file::table.filter(media_file::id.eq(&self.id)))
            .execute(conn)
            .await?;

        if let Err(e) = storage
            .file_store()
            .await?
            .delete(&media_file_path.clone().into())
            .await
        {
            warn!(error=?e, path=%media_file_path, "Failed to delete remote media file data");
        }

        if let Err(e) = conn
            .config()
            .local_store()
            .delete(&media_file_path.clone().into())
            .await
        {
            warn!(error=?e, path=%media_file_path, "Failed to delete local media file data");
        }

        Ok(())
    }
}

#[derive(Queryable, Insertable, Clone, Debug)]
#[diesel(table_name = alternate_file)]
pub(crate) struct AlternateFile {
    pub(crate) id: String,
    #[diesel(column_name = type_)]
    pub(crate) file_type: AlternateFileType,
    pub(crate) file_name: String,
    pub(crate) file_size: i32,
    #[diesel(deserialize_as = MimeField, serialize_as = MimeField)]
    pub(crate) mimetype: Mime,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) duration: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) media_file: String,
    pub(crate) local: bool,
}

impl AlternateFile {
    pub(crate) async fn list_for_catalog(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(AlternateFile, FilePath)>> {
        let files = alternate_file::table
            .inner_join(media_file::table.on(media_file::id.eq(alternate_file::media_file)))
            .inner_join(media_item::table.on(media_file::media_item.eq(media_item::id)))
            .filter(media_item::catalog.eq(&catalog))
            .select((alternate_file::all_columns, media_item::id))
            .load::<(AlternateFile, String)>(conn)
            .await?;

        Ok(files
            .into_iter()
            .map(|(alternate, media_item)| {
                let file_path = FilePath {
                    catalog: catalog.to_owned(),
                    item: media_item,
                    file: alternate.media_file.clone(),
                    file_name: alternate.file_name.clone(),
                };
                (alternate, file_path)
            })
            .collect())
    }

    pub(crate) async fn list_for_media_file(
        conn: &mut DbConnection<'_>,
        media_file: &str,
    ) -> Result<Vec<AlternateFile>> {
        Ok(alternate_file::table
            .filter(alternate_file::media_file.eq(media_file))
            .select(alternate_file::all_columns)
            .load::<AlternateFile>(conn)
            .await?)
    }

    pub(crate) async fn list_for_user_media(
        conn: &mut DbConnection<'_>,
        email: Option<&str>,
        item: &str,
        file: &str,
        mimetype: &Mime,
        alternate_type: AlternateFileType,
    ) -> Result<Vec<(AlternateFile, FilePath)>> {
        if let Some(email) = email {
            let files = user_catalog::table
                .filter(user_catalog::user.eq(email))
                .inner_join(media_item::table.on(media_item::catalog.eq(user_catalog::catalog)))
                .filter(media_item::id.eq(item))
                .filter(media_item::media_file.eq(file))
                .inner_join(
                    alternate_file::table
                        .on(media_item::media_file.eq(alternate_file::media_file.nullable())),
                )
                .filter(alternate_file::mimetype.eq(mimetype.as_ref()))
                .filter(alternate_file::type_.eq(alternate_type))
                .select((
                    alternate_file::all_columns,
                    media_item::id,
                    media_item::catalog,
                ))
                .load::<(AlternateFile, String, String)>(conn)
                .await?;

            if !files.is_empty() {
                return Ok(files
                    .into_iter()
                    .map(|(alternate, media_item, catalog)| {
                        let file_path = FilePath {
                            catalog,
                            item: media_item,
                            file: alternate.media_file.clone(),
                            file_name: alternate.file_name.clone(),
                        };
                        (alternate, file_path)
                    })
                    .collect::<Vec<(AlternateFile, FilePath)>>());
            }
        }

        Ok(vec![])
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(
        conn: &mut DbConnection<'_>,
        alternate_files: Vec<AlternateFile>,
    ) -> Result {
        for records in owned_batch(alternate_files, 500) {
            diesel::insert_into(alternate_file::table)
                .values(records)
                .on_conflict(alternate_file::id)
                .do_update()
                .set((
                    alternate_file::type_.eq(excluded(alternate_file::type_)),
                    alternate_file::file_name.eq(excluded(alternate_file::file_name)),
                    alternate_file::file_size.eq(excluded(alternate_file::file_size)),
                    alternate_file::mimetype.eq(excluded(alternate_file::mimetype)),
                    alternate_file::width.eq(excluded(alternate_file::width)),
                    alternate_file::height.eq(excluded(alternate_file::height)),
                    alternate_file::duration.eq(excluded(alternate_file::duration)),
                    alternate_file::frame_rate.eq(excluded(alternate_file::frame_rate)),
                    alternate_file::bit_rate.eq(excluded(alternate_file::bit_rate)),
                    alternate_file::media_file.eq(excluded(alternate_file::media_file)),
                    alternate_file::local.eq(excluded(alternate_file::local)),
                ))
                .execute(conn)
                .await?;
        }

        Ok(())
    }

    pub(crate) async fn delete(
        &self,
        conn: &mut DbConnection<'_>,
        storage: &Storage,
        path: &FilePath,
    ) -> Result {
        diesel::delete(alternate_file::table.filter(alternate_file::id.eq(&self.id)))
            .execute(conn)
            .await?;

        // We flag the media file as requiring re-processing here.
        diesel::update(media_file::table.filter(media_file::id.eq(&self.media_file)))
            .set(media_file::process_version.eq(0))
            .execute(conn)
            .await?;

        let result = if self.local {
            conn.config()
                .local_store()
                .delete(&path.clone().into())
                .await
        } else {
            storage
                .file_store()
                .await?
                .delete(&path.clone().into())
                .await
        };

        if let Err(e) = result {
            warn!(error=?e, path=%path, "Failed to delete alternate file");
        }

        Ok(())
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct MediaViewFileAlternate {
    #[serde(rename = "type")]
    pub(crate) type_: AlternateFileType,
    #[serde(with = "crate::shared::mime")]
    pub(crate) mimetype: Mime,
    pub(crate) width: i32,
    pub(crate) height: i32,
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaViewFile {
    pub(crate) id: String,
    pub(crate) file_size: i32,
    #[diesel(deserialize_as = MimeField)]
    #[serde(with = "crate::shared::mime")]
    pub(crate) mimetype: Mime,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) duration: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) uploaded: DateTime<Utc>,
    pub(crate) file_name: String,
    #[diesel(deserialize_as = Option<Value>)]
    pub(crate) alternates: MaybeVec<MediaViewFileAlternate>,
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaView {
    pub(crate) id: String,
    pub(crate) catalog: String,
    pub(crate) created: DateTime<Utc>,
    pub(crate) updated: DateTime<Utc>,
    pub(crate) datetime: DateTime<Utc>,
    #[serde(flatten)]
    pub(crate) metadata: MediaMetadata,
    pub(crate) taken_zone: Option<String>,
    pub(crate) file: Option<MediaViewFile>,
}

impl MediaView {
    pub(crate) async fn get(conn: &mut DbConnection<'_>, media: &[&str]) -> Result<Vec<MediaView>> {
        let media = media_view!()
            .filter(media_item::id.eq_any(media))
            .select(media_view_columns!())
            .load::<MediaView>(conn)
            .await?;

        Ok(media)
    }
}

#[typeshare]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct AlbumRelation {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct TagRelation {
    pub(crate) id: String,
    pub(crate) name: String,
}

#[typeshare]
#[derive(Serialize, Deserialize, Clone, Debug, deserialize::FromSqlRow, AsExpression)]
#[diesel(sql_type = db::schema::sql_types::Location)]
pub(crate) struct Location {
    pub(crate) left: f32,
    pub(crate) right: f32,
    pub(crate) top: f32,
    pub(crate) bottom: f32,
}

impl serialize::ToSql<db::schema::sql_types::Location, Pg> for Location {
    fn to_sql<'b>(&'b self, out: &mut serialize::Output<'b, '_, Pg>) -> serialize::Result {
        serialize::WriteTuple::<(
            sql_types::Float,
            sql_types::Float,
            sql_types::Float,
            sql_types::Float,
        )>::write_tuple(
            &(self.left, self.right, self.top, self.bottom),
            &mut out.reborrow(),
        )
    }
}

#[typeshare]
#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct PersonRelation {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) location: Option<Location>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(transparent)]
pub(crate) struct MaybeVec<T>(Vec<T>);

impl<T: DeserializeOwned> TryFrom<Option<Value>> for MaybeVec<T> {
    type Error = serde_json::Error;

    fn try_from(value: Option<Value>) -> result::Result<MaybeVec<T>, serde_json::Error> {
        if let Some(value) = value {
            Ok(MaybeVec(from_value(value)?))
        } else {
            Ok(MaybeVec(Vec::new()))
        }
    }
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaRelations {
    #[serde(flatten)]
    pub(crate) media: MediaView,
    #[diesel(deserialize_as = Option<Value>)]
    pub(crate) albums: MaybeVec<AlbumRelation>,
    #[diesel(deserialize_as = Option<Value>)]
    pub(crate) tags: MaybeVec<TagRelation>,
    #[diesel(deserialize_as = Option<Value>)]
    pub(crate) people: MaybeVec<PersonRelation>,
}

impl MediaRelations {
    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        media: &[&str],
    ) -> Result<Vec<MediaRelations>> {
        let media = media_view!()
            .inner_join(user_catalog::table.on(user_catalog::catalog.eq(media_item::catalog)))
            .left_join(album_relation::table.on(album_relation::media.eq(media_item::id)))
            .left_join(tag_relation::table.on(tag_relation::media.eq(media_item::id)))
            .left_join(person_relation::table.on(person_relation::media.eq(media_item::id)))
            .filter(user_catalog::user.eq(email))
            .filter(media_item::id.eq_any(media))
            .select((
                media_view_columns!(),
                album_relation::albums.nullable(),
                tag_relation::tags.nullable(),
                person_relation::people.nullable(),
            ))
            .load::<MediaRelations>(conn)
            .await?;

        Ok(media)
    }
}

#[derive(Insertable, Clone, Debug)]
#[diesel(table_name = auth_token)]
pub struct AuthToken {
    pub email: String,
    pub token: String,
    pub expiry: Option<DateTime<Utc>>,
}
