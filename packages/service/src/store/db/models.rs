use std::{
    cmp::min,
    collections::{HashMap, HashSet},
    result,
    str::FromStr,
    task::Poll,
};

use actix_web::web::Bytes;
use chrono::{DateTime, Duration, NaiveDateTime, Timelike, Utc};
use enum_repr::EnumRepr;
use futures::{Stream, StreamExt, TryStreamExt};
use itertools::Itertools;
use mime::Mime;
use pin_project::pin_project;
use pixelbin_shared::Ignorable;
use regex::Regex;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{from_value, to_string, Value};
use serde_plain::{derive_display_from_serialize, derive_fromstr_from_deserialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use sqlx::{
    postgres::PgRow, prelude::FromRow, types::Json, Error as SqlxError, QueryBuilder,
    Result as SqlxResult, Row,
};
use tokio::sync::mpsc::{channel, Receiver, Sender};
use tracing::{error, instrument, span, Level};

use crate::{
    mail::{send_messages, Subscribed, SubscriptionRequest},
    metadata::{alternates_for_media_file, lookup_timezone, media_datetime, Alternate},
    shared::{long_id, short_id, spawn_blocking},
    store::{
        aws::AwsClient,
        db::{
            functions::{from_mime, from_row},
            search::{Filterable, SearchQuery},
            AsDb, MediaAccess,
        },
        file::FileStore,
        models,
        path::{FilePath, MediaFileStore, MediaItemStore},
        DbConnection,
    },
    Config, Error, Result, Task,
};

const TOKEN_EXPIRY_DAYS: i64 = 90;

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

#[pin_project]
pub(crate) struct MediaViewStream {
    is_done: bool,
    receiver: Receiver<Option<Result<Vec<models::MediaView>>>>,
}

impl MediaViewStream {
    pub(crate) fn new() -> (Self, MediaViewSender) {
        let (sender, receiver) = channel(100);

        (
            Self {
                is_done: false,
                receiver,
            },
            MediaViewSender { sender },
        )
    }
}

impl Stream for MediaViewStream {
    type Item = Result<Bytes>;

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let this = self.project();

        if *this.is_done {
            return Poll::Ready(None);
        }

        match this.receiver.poll_recv(cx) {
            Poll::Ready(Some(item)) => match item {
                Some(Ok(media_view)) => match to_string(&media_view) {
                    Ok(st) => {
                        Poll::Ready(Some(Ok(Bytes::from(format!("{{ \"media\": {} }}\n", st)))))
                    }
                    Err(e) => {
                        *this.is_done = true;
                        Poll::Ready(Some(Ok(Bytes::from(format!("{{ \"error\": {} }}\n", e)))))
                    }
                },
                Some(Err(e)) => Poll::Ready(Some(Err(e))),
                None => Poll::Ready(None),
            },
            Poll::Ready(None) => {
                *this.is_done = true;
                Poll::Ready(None)
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

pub(crate) struct MediaViewSender {
    sender: Sender<Option<Result<Vec<models::MediaView>>>>,
}

impl MediaViewSender {
    async fn send_media_views(&self, mut media_views: Vec<MediaView>) {
        media_views
            .iter_mut()
            .for_each(|mv| mv.amend_for_access(MediaAccess::PublicMedia));
        self.sender.send(Some(Ok(media_views))).await.ignore();
    }

    pub(crate) async fn send_stream<S>(self, stream: S)
    where
        S: Stream<Item = SqlxResult<MediaView>> + Unpin,
    {
        let mut chunked = stream.try_ready_chunks(50);
        loop {
            match chunked.next().await {
                Some(Ok(media_views)) => {
                    self.send_media_views(media_views).await;
                }
                Some(Err(chunk_error)) => {
                    self.send_media_views(chunk_error.0).await;
                    self.send_error(chunk_error.1.into()).await;
                    break;
                }
                None => {
                    self.sender.send(None).await.ignore();
                    break;
                }
            }
        }
    }

    async fn send_error(&self, error: Error) {
        self.sender.send(Some(Err(error))).await.ignore();
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AlternateFileType {
    Thumbnail,
    Reencode,
    Social,
}
derive_display_from_serialize!(AlternateFileType);
derive_fromstr_from_deserialize!(AlternateFileType);

impl AlternateFileType {
    pub(crate) fn is_local(&self) -> bool {
        !matches!(self, AlternateFileType::Reencode)
    }

    pub(crate) fn decode(source: &str) -> SqlxResult<Self> {
        Self::from_str(source).map_err(|e| SqlxError::Decode(Box::new(e)))
    }
}

#[EnumRepr(type = "i32")]
#[derive(Default, Debug, Clone, Copy, Serialize_repr, Deserialize_repr, PartialEq, Eq)]
pub(crate) enum Orientation {
    #[default]
    TopLeft = 1,
    TopRight = 2,
    BottomRight = 3,
    BottomLeft = 4,
    LeftTop = 5,
    RightTop = 6,
    RightBottom = 7,
    LeftBottom = 8,
}

#[derive(Serialize, Clone, Debug)]
pub(crate) struct User {
    pub(crate) email: String,
    #[serde(skip)]
    pub(crate) password: Option<String>,
    pub(crate) fullname: Option<String>,
    pub(crate) administrator: bool,
    pub(crate) created: DateTime<Utc>,
    pub(crate) last_login: Option<DateTime<Utc>>,
    pub(crate) verified: bool,
}

impl User {
    pub(crate) async fn get<'a, D: AsDb<'a>>(mut conn: D, email: &str) -> Result<User> {
        Ok(sqlx::query!(
            r#"
            SELECT *
            FROM "user"
            WHERE "email"=$1
            "#,
            email
        )
        .map(|row| from_row!(User(row)))
        .fetch_one(conn.as_db())
        .await?)
    }

    #[instrument(skip_all)]
    pub(crate) async fn verify_credentials(
        conn: &mut DbConnection<'_>,
        email: &str,
        password: &str,
    ) -> Result<(models::User, String)> {
        let mut user = sqlx::query!(
            r#"
            SELECT *
            FROM "user"
            WHERE "email"=$1
            "#,
            email
        )
        .map(|row| from_row!(User(row)))
        .fetch_one(conn.as_db())
        .await?;

        if let Some(password_hash) = user.password.clone() {
            let password = password.to_owned();
            match spawn_blocking(span!(Level::TRACE, "verify password"), move || {
                bcrypt::verify(password, &password_hash)
            })
            .await
            {
                Ok(true) => (),
                _ => return Err(Error::NotFound),
            }
        } else {
            return Err(Error::NotFound);
        }

        let token = long_id("T");

        sqlx::query!(
            r#"
            INSERT INTO "auth_token" ("email", "token", "expiry")
            VALUES ($1,$2,$3)
            "#,
            email,
            token,
            Some(Utc::now() + Duration::days(TOKEN_EXPIRY_DAYS))
        )
        .execute(conn.as_db())
        .await?;

        user.last_login = Some(Utc::now());

        sqlx::query!(
            r#"
            UPDATE "user"
            SET "last_login"=$1
            WHERE "email"=$2
            "#,
            user.last_login,
            email,
        )
        .execute(conn.as_db())
        .await?;

        Ok((user, token))
    }

    #[instrument(skip_all)]
    pub(crate) async fn verify_token(
        conn: &mut DbConnection<'_>,
        token: &str,
    ) -> Result<Option<models::User>> {
        let expiry = Utc::now() + Duration::days(TOKEN_EXPIRY_DAYS);

        let email = match sqlx::query_scalar!(
            r#"
            UPDATE "auth_token"
            SET "expiry"=$1
            WHERE "token"=$2
            RETURNING "email"
            "#,
            expiry,
            token
        )
        .fetch_optional(conn.as_db())
        .await?
        {
            Some(u) => u,
            None => return Ok(None),
        };

        let user = sqlx::query!(
            r#"
            UPDATE "user"
            SET "last_login"=CURRENT_TIMESTAMP
            WHERE "email"=$1
            RETURNING "user".*
            "#,
            email
        )
        .map(|row| from_row!(User(row)))
        .fetch_optional(conn.as_db())
        .await?;

        Ok(user)
    }

    pub(crate) async fn delete_token(conn: &mut DbConnection<'_>, token: &str) -> Result {
        sqlx::query!(
            r#"
            DELETE FROM "auth_token"
            WHERE "token"=$1
            "#,
            token
        )
        .execute(conn.as_db())
        .await?;

        Ok(())
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
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
    pub(crate) async fn file_store(&self, config: &Config) -> Result<impl FileStore> {
        let client = AwsClient::from_storage(self, config).await?;

        Ok(client)
    }

    pub(crate) async fn online_uri(
        &self,
        path: &FilePath,
        mimetype: &Mime,
        filename: Option<&str>,
        config: &Config,
    ) -> Result<String> {
        let client = AwsClient::from_storage(self, config).await?;
        client.file_uri(path, mimetype, filename).await
    }

    pub(crate) async fn get_for_catalog(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Storage> {
        Ok(sqlx::query!(
            r#"
            SELECT "storage".*
            FROM "storage" JOIN "catalog" ON "catalog"."storage"="storage"."id"
            WHERE "catalog"."id"=$1
            "#,
            catalog
        )
        .map(|row| from_row!(Storage(row)))
        .fetch_one(conn)
        .await?)
    }

    pub(crate) async fn list_for_user<'c, D: AsDb<'c>>(
        mut conn: D,
        email: &str,
    ) -> Result<Vec<Storage>> {
        Ok(sqlx::query!(
            r#"
            SELECT "storage".*
            FROM "storage"
            WHERE "owner"=$1
            "#,
            email
        )
        .map(|row| from_row!(Storage(row)))
        .fetch_all(conn.as_db())
        .await?)
    }
}

#[derive(Serialize, Clone, Debug)]
pub(crate) struct Catalog {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) storage: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserCatalog {
    #[serde(flatten)]
    pub(crate) catalog: models::Catalog,
    pub(crate) writable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserCatalogWithCount {
    #[serde(flatten)]
    catalog: models::Catalog,
    writable: bool,
    media: i64,
}

impl Catalog {
    #[instrument(skip_all)]
    pub(crate) async fn stream_media(
        self,
        mut conn: DbConnection<'static>,
        sender: MediaViewSender,
    ) {
        let stream = sqlx::query!(
            r#"
            SELECT "media_view".*
            FROM "media_view"
            WHERE "media_view"."catalog"=$1
            ORDER BY "datetime" DESC
            "#,
            self.id
        )
        .try_map(|row| Ok(from_row!(MediaView(row))))
        .fetch(&mut conn);

        sender.send_stream(stream).await
    }

    pub(crate) async fn list<'conn>(conn: &mut DbConnection<'_>) -> Result<Vec<Catalog>> {
        Ok(sqlx::query!(r#"SELECT * FROM "catalog""#)
            .map(|row| from_row!(Catalog(row)))
            .fetch_all(conn)
            .await?)
    }

    pub(crate) async fn list_for_user_with_count<'c, D: AsDb<'c>>(
        mut conn: D,
        email: &str,
    ) -> Result<Vec<UserCatalogWithCount>> {
        Ok(sqlx::query!(
            r#"
            SELECT "catalog".*, "writable", "media"
            FROM "user_catalog"
                JOIN "catalog" ON "catalog"."id" = "user_catalog"."catalog"
                LEFT JOIN (
                    SELECT "catalog", COUNT("id") AS "media"
                    FROM "media_item"
                    WHERE NOT "deleted"
                    GROUP BY "catalog"
                ) AS "media" ON "media"."catalog"="catalog"."id"
            WHERE "user_catalog"."user" = $1
            "#,
            email
        )
        .map(|row| UserCatalogWithCount {
            catalog: from_row!(Catalog(row)),
            writable: row.writable.unwrap_or_default(),
            media: row.media.unwrap_or_default(),
        })
        .fetch_all(conn.as_db())
        .await?)
    }

    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        catalog: &str,
        want_writable: bool,
    ) -> Result<UserCatalog> {
        Ok(sqlx::query!(
            r#"
            SELECT "catalog".*,"writable"
            FROM "catalog" JOIN "user_catalog" ON "catalog"."id"="user_catalog"."catalog"
            WHERE
                "user_catalog"."user"=$1 AND
                "catalog"."id"=$2 AND
                ("user_catalog"."writable" OR $3)
            "#,
            email,
            catalog,
            want_writable
        )
        .map(|row| UserCatalog {
            catalog: from_row!(Catalog(row)),
            writable: row.writable.unwrap_or_default(),
        })
        .fetch_one(conn)
        .await?)
    }

    pub(crate) async fn get_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: &str,
        catalog: &str,
    ) -> Result<UserCatalogWithCount> {
        let catalog = sqlx::query!(
            r#"
            SELECT "catalog".*, "user_catalog"."writable", "media"
            FROM catalog
                JOIN "user_catalog" ON "catalog"."id"="user_catalog"."catalog"
                LEFT JOIN (
                    SELECT "catalog", COUNT("id") AS "media"
                    FROM "media_item"
                    WHERE NOT "deleted"
                    GROUP BY "catalog"
                ) AS "media" ON "media"."catalog"="catalog"."id"
            WHERE
                "user_catalog"."user"=$1 AND
                "catalog".id=$2
            "#,
            email,
            catalog
        )
        .map(|row| UserCatalogWithCount {
            catalog: from_row!(Catalog(row)),
            writable: row.writable.unwrap_or_default(),
            media: row.media.unwrap_or_default(),
        })
        .fetch_one(conn)
        .await?;

        Ok(catalog)
    }
}

#[derive(Serialize, Clone, Debug)]
pub(crate) struct Person {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) catalog: String,
}

impl Person {
    pub(crate) async fn list_for_user<'c, D: AsDb<'c>>(
        mut conn: D,
        email: &str,
    ) -> Result<Vec<Person>> {
        Ok(sqlx::query!(
            r#"
            SELECT "person".*
            FROM "person"
                JOIN "user_catalog" ON "user_catalog"."catalog"="person"."catalog"
            WHERE
                "user_catalog"."user"=$1
            "#,
            email
        )
        .map(|row| from_row!(Person(row)))
        .fetch_all(conn.as_db())
        .await?)
    }

    #[instrument(skip(conn))]
    pub(crate) async fn get_or_create(
        conn: &mut DbConnection<'_>,
        catalog: &str,
        name: &str,
    ) -> Result<Person> {
        match sqlx::query!(
            r#"
            SELECT *
            FROM "person"
            WHERE
                "catalog"=$1 AND
                LOWER("name")=$2
            "#,
            catalog,
            name.to_lowercase()
        )
        .map(|row| from_row!(Person(row)))
        .fetch_optional(&mut *conn)
        .await?
        {
            Some(p) => Ok(p),
            None => {
                let new_person = Person {
                    id: short_id("P"),
                    name: name.to_owned(),
                    catalog: catalog.to_owned(),
                };

                sqlx::query!(
                    r#"
                    INSERT INTO "person" ("id", "name", "catalog")
                    VALUES ($1, $2, $3)
                    "#,
                    new_person.id,
                    name,
                    catalog
                )
                .execute(conn)
                .await?;

                Ok(new_person)
            }
        }
    }
}

#[derive(Serialize, Clone, Debug)]
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
        if people.is_empty() {
            return Ok(());
        }

        MediaPerson::upsert(conn, people).await?;

        let people_ids: Vec<String> = people.iter().map(|p| p.person.clone()).collect();

        sqlx::query!(
            r#"
            DELETE FROM "media_person"
            WHERE
                "media"=$1 AND
                "person" != ALL($2)
            "#,
            media,
            &people_ids
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, people: &[MediaPerson]) -> Result {
        if people.is_empty() {
            return Ok(());
        }

        for records in batch(people, 500) {
            let mut catalog: Vec<String> = Vec::new();
            let mut media: Vec<String> = Vec::new();
            let mut person: Vec<String> = Vec::new();
            let mut location: Vec<Option<Location>> = Vec::new();

            records.iter().for_each(|media_person| {
                catalog.push(media_person.catalog.clone());
                media.push(media_person.media.clone());
                person.push(media_person.person.clone());
                location.push(media_person.location);
            });

            sqlx::query!(
                r#"
                INSERT INTO "media_person" (
                    "catalog",
                    "media",
                    "person",
                    "location"."left",
                    "location"."right",
                    "location"."top",
                    "location"."bottom"
                )
                SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::location[])
                ON CONFLICT("media", "person") DO UPDATE SET
                    "location"="excluded"."location"
                "#,
                &catalog,
                &media,
                &person,
                &location as &[Option<Location>]
            )
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }
}

#[derive(Serialize, Clone, Debug)]
pub(crate) struct Tag {
    pub(crate) id: String,
    pub(crate) parent: Option<String>,
    pub(crate) name: String,
    pub(crate) catalog: String,
}

impl Tag {
    pub(crate) async fn list_for_user<'c, D: AsDb<'c>>(
        mut conn: D,
        email: &str,
    ) -> Result<Vec<Tag>> {
        Ok(sqlx::query!(
            r#"
            SELECT "tag".*
            FROM "tag"
                JOIN "user_catalog" ON "user_catalog"."catalog"="tag"."catalog"
            WHERE "user_catalog"."user"=$1
            "#,
            email
        )
        .map(|row| from_row!(Tag(row)))
        .fetch_all(conn.as_db())
        .await?)
    }

    async fn get_or_create(
        conn: &mut DbConnection<'_>,
        catalog: &str,
        name: &str,
        parent: Option<&str>,
    ) -> Result<Tag> {
        let tag = if let Some(parent) = parent {
            sqlx::query!(
                r#"
                SELECT "tag".*
                FROM "tag"
                WHERE "tag"."catalog"=$1 AND LOWER("name")=$2 AND "parent"=$3
                "#,
                catalog,
                name.to_lowercase(),
                parent
            )
            .map(|row| from_row!(Tag(row)))
            .fetch_optional(&mut *conn)
            .await?
        } else {
            sqlx::query!(
                r#"
                SELECT "tag".*
                FROM "tag"
                WHERE "tag"."catalog"=$1 AND LOWER("name")=$2
                "#,
                catalog,
                name.to_lowercase()
            )
            .map(|row| from_row!(Tag(row)))
            .fetch_optional(&mut *conn)
            .await?
        };

        match tag {
            Some(t) => Ok(t),
            None => {
                let new_tag = Tag {
                    id: short_id("T"),
                    parent: parent.map(|p| p.to_owned()),
                    name: name.to_owned(),
                    catalog: catalog.to_owned(),
                };

                sqlx::query!(
                    r#"
                    INSERT INTO "tag" ("id", "parent", "catalog", "name")
                    VALUES ($1, $2, $3, $4)
                    "#,
                    new_tag.id,
                    parent,
                    catalog,
                    name
                )
                .execute(conn)
                .await?;

                Ok(new_tag)
            }
        }
    }

    #[instrument(skip(conn))]
    pub(crate) async fn get_or_create_hierarchy(
        conn: &mut DbConnection<'_>,
        catalog: &str,
        hierarchy: &[String],
    ) -> Result<Tag> {
        assert!(!hierarchy.is_empty());

        let mut current_tag = Tag::get_or_create(conn, catalog, &hierarchy[0], None).await?;

        for name in hierarchy.iter().skip(1) {
            current_tag = Tag::get_or_create(conn, catalog, name, Some(&current_tag.id)).await?;
        }

        Ok(current_tag)
    }
}

#[derive(Serialize, Clone, Debug)]
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
        sqlx::query!(
            r#"
            DELETE FROM "media_album"
            WHERE "album"=$1 AND "media"=ANY($2)
            "#,
            album,
            media
        )
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
        if albums.is_empty() {
            return Ok(());
        }

        MediaAlbum::upsert(conn, albums).await?;

        let album_ids: Vec<String> = albums.iter().map(|a| a.album.clone()).collect();

        sqlx::query!(
            r#"
            DELETE FROM "media_album"
            WHERE "media"=$1 AND "album"!=ALL($2)
            "#,
            media,
            &album_ids
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, albums: &[MediaAlbum]) -> Result {
        if albums.is_empty() {
            return Ok(());
        }

        for records in batch(albums, 500) {
            let mut catalog: Vec<String> = Vec::new();
            let mut album: Vec<String> = Vec::new();
            let mut media: Vec<String> = Vec::new();

            records.iter().for_each(|media_album| {
                catalog.push(media_album.catalog.clone());
                media.push(media_album.media.clone());
                album.push(media_album.album.clone());
            });

            sqlx::query!(
                r#"
                INSERT INTO "media_album" (
                    "catalog",
                    "album",
                    "media"
                )
                SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])
                ON CONFLICT DO NOTHING
                "#,
                &catalog,
                &album,
                &media,
            )
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }
}

#[derive(Serialize, Clone, Debug)]
pub(crate) struct Album {
    pub(crate) id: String,
    pub(crate) parent: Option<String>,
    pub(crate) name: String,
    pub(crate) catalog: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AlbumWithCount {
    #[serde(flatten)]
    album: Album,
    media: i64,
}

impl Album {
    #[instrument(skip_all)]
    pub(crate) async fn stream_media(
        self,
        mut conn: DbConnection<'static>,
        recursive: bool,
        sender: MediaViewSender,
    ) {
        let stream = if recursive {
            sqlx::query!(
                r#"
                SELECT "media_view".*
                FROM "media_view"
                WHERE "media_view"."id" IN (
                    SELECT "media_album"."media"
                    FROM "media_album"
                        JOIN "album_descendent" ON "album_descendent"."descendent"="media_album"."album"
                    WHERE "album_descendent"."id"=$1
                )
                ORDER BY datetime DESC
                "#,
                self.id
            )
            .try_map(|row| Ok(from_row!(MediaView(row))))
            .fetch(&mut conn)
        } else {
            sqlx::query!(
                r#"
                SELECT "media_view".*
                FROM "media_view"
                    JOIN "media_album" ON "media_album"."media"="media_view"."id"
                WHERE "media_album"."album"=$1
                ORDER BY "datetime" DESC
                "#,
                self.id
            )
            .try_map(|row| Ok(from_row!(MediaView(row))))
            .fetch(&mut conn)
        };

        sender.send_stream(stream).await
    }

    pub(crate) async fn list_for_user_with_count<'c, D: AsDb<'c>>(
        mut conn: D,
        email: &str,
    ) -> Result<Vec<AlbumWithCount>> {
        Ok(sqlx::query!(
            r#"
            SELECT "album".*, COUNT("media_album"."media") AS count
            FROM "user_catalog"
                JOIN "album" USING ("catalog")
                LEFT JOIN "media_album" ON "media_album"."album"="album"."id"
            WHERE "user_catalog"."user"=$1
            GROUP BY "album"."id"
            "#,
            email
        )
        .map(|row| AlbumWithCount {
            album: from_row!(Album(row)),
            media: row.count.unwrap_or_default(),
        })
        .fetch_all(conn.as_db())
        .await?)
    }

    pub(crate) async fn get_writable_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        id: &str,
    ) -> Result<Album> {
        Ok(sqlx::query!(
            r#"
            SELECT *
            FROM "album"
            WHERE "id"=$1 AND "catalog" IN (
                SELECT "user_catalog"."catalog"
                FROM "user_catalog"
                WHERE "user_catalog"."user"=$2 AND "user_catalog"."writable"
            )
            "#,
            id,
            email
        )
        .map(|row| from_row!(Album(row)))
        .fetch_one(conn)
        .await?)
    }

    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        album: &str,
    ) -> Result<Album> {
        Ok(sqlx::query!(
            r#"
            SELECT "album".*
            FROM "album"
                JOIN "user_catalog" ON "user_catalog"."catalog"="album"."catalog"
            WHERE "user_catalog"."user"=$1 AND "album"."id"=$2
            "#,
            email,
            album
        )
        .map(|row| from_row!(Album(row)))
        .fetch_one(conn)
        .await?)
    }

    pub(crate) async fn get_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: &str,
        album: &str,
        recursive: bool,
    ) -> Result<AlbumWithCount> {
        if recursive {
            Ok(sqlx::query!(
                r#"
                SELECT "album".*, COUNT("media_album"."media") AS "count"
                FROM "user_catalog"
                    JOIN "album" USING ("catalog")
                    JOIN "album_descendent" USING ("id")
                    LEFT JOIN "media_album" ON "album_descendent"."descendent"="media_album"."album"
                WHERE
                    "user_catalog"."user"=$1 AND
                    "album"."id"=$2
                GROUP BY "album"."id"
                "#,
                email,
                album
            )
            .map(|row| AlbumWithCount {
                album: from_row!(Album(row)),
                media: row.count.unwrap_or_default(),
            })
            .fetch_one(conn)
            .await?)
        } else {
            Ok(sqlx::query!(
                r#"
                SELECT "album".*, COUNT("media_album"."media") AS "count"
                FROM user_catalog
                    JOIN "album" USING ("catalog")
                    LEFT JOIN "media_album" ON "album"."id"="media_album"."album"
                WHERE
                    "user_catalog"."user"=$1 AND
                    "album"."id"=$2
                GROUP BY "album"."id"
                "#,
                email,
                album
            )
            .map(|row| AlbumWithCount {
                album: from_row!(Album(row)),
                media: row.count.unwrap_or_default(),
            })
            .fetch_one(conn)
            .await?)
        }
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, albums: &[Album]) -> Result {
        if albums.is_empty() {
            return Ok(());
        }

        for records in batch(albums, 500) {
            let mut id: Vec<String> = Vec::new();
            let mut catalog: Vec<String> = Vec::new();
            let mut name: Vec<String> = Vec::new();
            let mut parent: Vec<Option<String>> = Vec::new();

            records.iter().for_each(|album| {
                id.push(album.id.clone());
                catalog.push(album.catalog.clone());
                parent.push(album.parent.clone());
                name.push(album.name.clone());
            });

            sqlx::query!(
                r#"
                INSERT INTO "album" ("id", "parent", "name", "catalog")
                SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[])
                ON CONFLICT("id") DO UPDATE SET
                    "name"="excluded"."name",
                    "parent"="excluded"."parent"
                "#,
                &id,
                &parent as &[Option<String>],
                &name,
                &catalog,
            )
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn delete(conn: &mut DbConnection<'_>, albums: &[String]) -> Result {
        sqlx::query!(r#"DELETE FROM "album" WHERE "id"=ANY($1)"#, albums)
            .execute(conn)
            .await?;

        Ok(())
    }
}

#[derive(Serialize, Clone, Debug)]
pub(crate) struct SavedSearch {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) shared: bool,
    pub(crate) query: SearchQuery,
    pub(crate) catalog: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SavedSearchWithCount {
    #[serde(flatten)]
    search: models::SavedSearch,
    media: i64,
}

impl SavedSearch {
    #[instrument(skip_all)]
    pub(crate) async fn stream_media(
        self,
        mut conn: DbConnection<'_>,
        since: Option<DateTime<Utc>>,
        sender: MediaViewSender,
    ) {
        let stream = if let Some(since) = since {
            sqlx::query!(
                r#"
                SELECT "media_view".*
                FROM "media_view"
                    JOIN "media_search" ON "media_search"."media"="media_view"."id"
                WHERE "media_search"."search"=$1 AND "media_search"."added" > $2
                ORDER BY "datetime" DESC
                "#,
                self.id,
                since
            )
            .try_map(|row| Ok(from_row!(MediaView(row))))
            .fetch(&mut conn)
        } else {
            sqlx::query!(
                r#"
                SELECT "media_view".*
                FROM "media_view"
                    JOIN "media_search" ON "media_search"."media"="media_view"."id"
                WHERE "media_search"."search"=$1
                ORDER BY "datetime" DESC
                "#,
                self.id
            )
            .try_map(|row| Ok(from_row!(MediaView(row))))
            .fetch(&mut conn)
        };

        sender.send_stream(stream).await
    }

    pub(crate) async fn subscribe(self, mut conn: DbConnection<'_>, email: String) -> Result {
        let token = long_id("")[1..].to_string();

        let existing = sqlx::query_scalar!(
            r#"
            SELECT "email"
            FROM "subscription"
            WHERE "email"=$1 AND "search"=$2
            "#,
            &email,
            &self.id,
        )
        .fetch_optional(&mut conn)
        .await?;

        if existing.is_some() {
            let template = Subscribed {
                base_url: conn.config().base_url.to_string(),
                email: &email,
                search: &self,
            };

            send_messages(conn.config(), &[template]).await;
        } else {
            sqlx::query!(
                r#"
                INSERT INTO "subscription_request" ("email", "search", "token")
                VALUES ($1, $2, $3)
                "#,
                &email,
                &self.id,
                &token,
            )
            .execute(&mut conn)
            .await?;

            let template = SubscriptionRequest {
                base_url: conn.config().base_url.to_string(),
                email: &email,
                search: &self,
                token: &token,
            };

            send_messages(conn.config(), &[template]).await;
        }

        Ok(())
    }

    pub(crate) async fn confirm_subscription(mut conn: DbConnection<'_>, token: String) -> Result {
        let (email, search) = sqlx::query!(
            r#"
            DELETE FROM "subscription_request"
            USING "saved_search"
            WHERE
                "subscription_request"."search"="saved_search"."id" AND
                "token"=$1 AND "request" > CURRENT_TIMESTAMP - INTERVAL '1 day'
            RETURNING "email", "saved_search".*
            "#,
            &token
        )
        .try_map(|row| Ok((row.email, from_row!(SavedSearch(row)))))
        .fetch_one(&mut conn)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO "subscription" ("email", "search")
            VALUES ($1,$2)
            "#,
            &email,
            &search.id
        )
        .execute(&mut conn)
        .await?;

        let template = Subscribed {
            base_url: conn.config().base_url.to_string(),
            email: &email,
            search: &search,
        };

        send_messages(conn.config(), &[template]).await;

        Ok(())
    }

    pub(crate) async fn unsubscribe(
        conn: &mut DbConnection<'_>,
        email: &str,
        search: Option<&str>,
    ) -> Result {
        if let Some(search) = search {
            sqlx::query!(
                r#"
                DELETE FROM subscription
                WHERE email=$1 AND search=$2
                "#,
                &email,
                &search
            )
            .execute(conn)
            .await?;
        } else {
            sqlx::query!(
                r#"
                DELETE FROM subscription
                WHERE email=$1
                "#,
                &email
            )
            .execute(conn)
            .await?;
        }

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, searches: &[SavedSearch]) -> Result {
        if searches.is_empty() {
            return Ok(());
        }

        for records in batch(searches, 500) {
            let mut id: Vec<String> = Vec::new();
            let mut catalog: Vec<String> = Vec::new();
            let mut name: Vec<String> = Vec::new();
            let mut shared: Vec<bool> = Vec::new();
            let mut query: Vec<Json<&SearchQuery>> = Vec::new();

            records.iter().for_each(|search| {
                id.push(search.id.clone());
                catalog.push(search.catalog.clone());
                name.push(search.name.clone());
                shared.push(search.shared);
                query.push(Json(&search.query));
            });

            sqlx::query!(
                r#"
                INSERT INTO "saved_search" ("id", "name", "shared", "query", "catalog")
                SELECT * FROM UNNEST($1::text[], $2::text[], $3::bool[], $4::jsonb[], $5::text[])
                ON CONFLICT("id") DO UPDATE SET
                    "name"="excluded"."name",
                    "shared"="excluded"."shared",
                    "query"="excluded"."query"
                "#,
                &id,
                &name,
                &shared,
                &query as &[Json<&SearchQuery>],
                &catalog,
            )
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }

    #[instrument(skip(self, conn), fields(search = self.id))]
    pub(crate) async fn update(&self, conn: &mut DbConnection<'_>) -> Result {
        let mut builder = QueryBuilder::new(
            r#"SELECT DISTINCT "media_view"."id" FROM "media_view" WHERE "catalog"="#,
        );
        builder.push_bind(&self.catalog);
        builder.push(" AND ");

        self.query.bind_filter(&self.catalog, &mut builder);

        let matching_media: Vec<String> = builder
            .build_query_scalar()
            .persistent(false)
            .fetch_all(&mut *conn)
            .await?;

        let mut catalog = Vec::<String>::new();
        let mut media = Vec::<String>::new();
        let mut search = Vec::<String>::new();
        let mut added = Vec::<DateTime<Utc>>::new();

        let now = Utc::now();
        matching_media.iter().for_each(|id| {
            catalog.push(self.catalog.clone());
            media.push(id.to_owned());
            search.push(self.id.to_string());
            added.push(now);
        });

        sqlx::query!(
            r#"
            INSERT INTO "media_search" ("catalog", "media", "search", "added")
            SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::timestamptz[])
            ON CONFLICT DO NOTHING
            "#,
            &catalog,
            &media,
            &search,
            &added,
        )
        .execute(&mut *conn)
        .await?;

        sqlx::query!(
            r#"
            DELETE FROM "media_search"
            WHERE "search"=$1 AND "media"!=ALL($2)
            "#,
            &self.id,
            &matching_media
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    pub(crate) async fn update_for_catalog(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
        let was_public = MediaItem::list_public(conn, catalog).await?;

        let searches = sqlx::query!(
            r#"
            SELECT *
            FROM "saved_search"
            WHERE "catalog"=$1
            "#,
            catalog
        )
        .try_map(|row| Ok(from_row!(SavedSearch(row))))
        .fetch_all(&mut *conn)
        .await?;

        for search in searches {
            search.update(conn).await?;
        }

        let now_public = MediaItem::list_public(conn, catalog).await?;

        let changed_items: Vec<String> = was_public
            .symmetric_difference(&now_public)
            .cloned()
            .collect();

        let mut alternates_to_update = Vec::new();

        for (media_file, media_file_store) in
            models::MediaFile::list_for_items(conn, &changed_items).await?
        {
            let alternates = alternates_for_media_file(
                conn.config(),
                &media_file,
                now_public.contains(&media_file_store.item),
            );

            alternates_to_update.push((media_file, media_file_store, alternates));
        }

        models::AlternateFile::sync_for_media_files(conn, alternates_to_update).await
    }

    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: Option<&str>,
        search: &str,
    ) -> Result<SavedSearch> {
        let email = email.unwrap_or_default().to_owned();

        Ok(sqlx::query!(
            r#"
            SELECT *
            FROM "saved_search"
            WHERE
                "saved_search"."id"=$1 AND
                (
                    "shared" OR
                    "catalog" IN (
                        SELECT "user_catalog"."catalog"
                        FROM "user_catalog"
                        WHERE "user"=$2
                    )
                )
            "#,
            search,
            email
        )
        .try_map(|row| Ok(from_row!(SavedSearch(row))))
        .fetch_one(conn)
        .await?)
    }

    pub(crate) async fn get_for_user_with_count(
        conn: &mut DbConnection<'_>,
        email: Option<&str>,
        search: &str,
    ) -> Result<SavedSearchWithCount> {
        let email = email.unwrap_or_default().to_owned();

        Ok(sqlx::query!(
            r#"
            SELECT "saved_search".*, COUNT("media_search"."media") AS "count"
            FROM "saved_search"
                LEFT JOIN "media_search" ON "saved_search"."id"="media_search"."search"
            WHERE
                "saved_search"."id"=$1 AND
                (
                    "saved_search"."shared" OR
                    "saved_search"."catalog" IN (
                        SELECT "user_catalog"."catalog"
                        FROM "user_catalog"
                        WHERE "user"=$2
                    )
                )
            GROUP BY "saved_search"."id"
            "#,
            search,
            email
        )
        .try_map(|row| {
            Ok(SavedSearchWithCount {
                search: from_row!(SavedSearch(row)),
                media: row.count.unwrap_or_default(),
            })
        })
        .fetch_one(conn)
        .await?)
    }

    pub(crate) async fn list_for_user_with_count<'c, D: AsDb<'c>>(
        mut conn: D,
        email: &str,
    ) -> Result<Vec<SavedSearchWithCount>> {
        Ok(sqlx::query!(
            r#"
            SELECT "saved_search".*, COUNT("media_search"."media") AS "count"
            FROM "user_catalog"
                JOIN "saved_search" USING ("catalog")
                LEFT JOIN "media_search" ON "media_search"."search"="saved_search"."id"
            WHERE "user_catalog"."user"=$1
            GROUP BY "saved_search"."id"
            "#,
            email
        )
        .try_map(|row| {
            Ok(SavedSearchWithCount {
                search: from_row!(SavedSearch(row)),
                media: row.count.unwrap_or_default(),
            })
        })
        .fetch_all(conn.as_db())
        .await?)
    }
}

fn clear_matching<T: PartialEq>(field: &mut Option<T>, reference: &Option<T>) {
    if field == reference {
        *field = None;
    }
}

#[derive(Clone, Debug)]
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
        if tags.is_empty() {
            return Ok(());
        }

        MediaTag::upsert(conn, tags).await?;

        let tag_ids = tags.iter().map(|t| t.tag.clone()).collect_vec();

        sqlx::query!(
            r#"
            DELETE FROM "media_tag"
            WHERE "media"=$1 AND "tag"!=ALL($2)
            "#,
            media,
            &tag_ids
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, tags: &[MediaTag]) -> Result {
        if tags.is_empty() {
            return Ok(());
        }

        for records in batch(tags, 500) {
            let mut catalog: Vec<String> = Vec::new();
            let mut media: Vec<String> = Vec::new();
            let mut tag: Vec<String> = Vec::new();

            records.iter().for_each(|media_tag| {
                catalog.push(media_tag.catalog.clone());
                media.push(media_tag.media.clone());
                tag.push(media_tag.tag.clone());
            });

            sqlx::query!(
                r#"
                INSERT INTO "media_tag" ("catalog", "media", "tag")
                SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])
                ON CONFLICT DO NOTHING
                "#,
                &catalog,
                &media,
                &tag,
            )
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }
}

#[derive(Serialize, PartialEq, Default, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaMetadata {
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
    pub orientation: Option<Orientation>,
    pub iso: Option<i32>,
    pub rating: Option<i32>,
    pub longitude: Option<f32>,
    pub latitude: Option<f32>,
    pub altitude: Option<f32>,
    pub aperture: Option<f32>,
    pub focal_length: Option<f32>,
    pub taken: Option<NaiveDateTime>,
}

impl<'q> FromRow<'q, PgRow> for MediaMetadata {
    fn from_row(row: &'q PgRow) -> SqlxResult<Self> {
        let orientation: Option<i32> = row.try_get("orientation")?;

        Ok(MediaMetadata {
            filename: row.try_get("filename")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            label: row.try_get("label")?,
            category: row.try_get("category")?,
            location: row.try_get("location")?,
            city: row.try_get("city")?,
            state: row.try_get("state")?,
            country: row.try_get("country")?,
            make: row.try_get("make")?,
            model: row.try_get("model")?,
            lens: row.try_get("lens")?,
            photographer: row.try_get("photographer")?,
            shutter_speed: row.try_get("shutter_speed")?,
            orientation: orientation.and_then(Orientation::from_repr),
            iso: row.try_get("iso")?,
            rating: row.try_get("rating")?,
            longitude: row.try_get("longitude")?,
            latitude: row.try_get("latitude")?,
            altitude: row.try_get("altitude")?,
            aperture: row.try_get("aperture")?,
            focal_length: row.try_get("focal_length")?,
            taken: row.try_get("taken")?,
        })
    }
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

#[derive(Clone, Debug)]
pub(crate) struct MediaItem {
    pub id: String,
    pub deleted: bool,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub metadata: MediaMetadata,
    pub taken_zone: Option<String>,
    pub catalog: String,
    pub media_file: Option<String>,
    pub datetime: DateTime<Utc>,
    pub public: bool,
}

impl MediaItem {
    pub(crate) fn new(catalog: &str) -> Self {
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
            public: false,
        }
    }

    pub(crate) async fn list_not_deleted(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<MediaItemStore>> {
        Ok(sqlx::query!(
            r#"
            SELECT *
            FROM "media_item"
            WHERE NOT "deleted" AND "catalog"=$1
            "#,
            catalog
        )
        .map(|row| MediaItemStore {
            catalog: row.catalog,
            item: row.id,
        })
        .fetch_all(conn.as_db())
        .await?)
    }

    pub(crate) async fn list_deleted(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<MediaItem>> {
        let media = sqlx::query!(
            r#"
            SELECT *
            FROM "media_item"
            WHERE "deleted" AND "catalog"=$1
            "#,
            catalog
        )
        .map(|row| from_row!(MediaItem(row)))
        .fetch_all(conn)
        .await?;

        Ok(media)
    }

    pub(crate) async fn list_public(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<HashSet<String>> {
        let media = sqlx::query_scalar!(
            r#"
            SELECT "id"
            FROM "media_item"
            WHERE "catalog"=$1 AND
                (
                    "public" OR
                    "id" IN (
                        SELECT "media_search"."media"
                        FROM "media_search"
                            JOIN "saved_search" ON "saved_search"."id"="media_search"."search"
                        WHERE "saved_search"."shared"
                    )
                )
            "#,
            catalog
        )
        .fetch_all(conn)
        .await?;

        Ok(media.into_iter().collect())
    }

    pub(crate) async fn mark_deleted(conn: &mut DbConnection<'_>, media: &[String]) -> Result {
        sqlx::query!(
            r#"
            UPDATE "media_item"
            SET "deleted"=TRUE
            WHERE "id"=ANY($1)
            "#,
            media
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_prunable(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(MediaItem, MediaItemStore)>> {
        // Lists the items with no media_files.
        let items = sqlx::query!(
            r#"
            SELECT "media_item".*
            FROM "media_item"
                LEFT JOIN "media_file" ON "media_item"."id"="media_file"."media_item"
            WHERE
                "media_item"."catalog"=$1 AND
                (
                    (
                        "media_file"."id" IS NULL AND
                        "media_item"."created" < (CURRENT_TIMESTAMP - interval '1 week')
                    )
                    OR
                    "media_item"."deleted"
                )
            "#,
            catalog
        )
        .map(|row| from_row!(MediaItem(row)))
        .fetch_all(conn)
        .await?;

        Ok(items
            .into_iter()
            .map(|media_item| {
                let media_file_store = MediaItemStore {
                    catalog: media_item.catalog.clone(),
                    item: media_item.id.clone(),
                };
                (media_item, media_file_store)
            })
            .collect())
    }

    pub(crate) async fn delete(conn: &mut DbConnection<'_>, media: &[String]) -> Result {
        sqlx::query!(r#"DELETE FROM "media_item" WHERE "id"=ANY($1)"#, media)
            .execute(conn)
            .await?;

        Ok(())
    }

    pub(crate) async fn get(conn: &mut DbConnection<'_>, id: &str) -> Result<Self> {
        Ok(sqlx::query!(
            r#"
            SELECT "media_item".*
            FROM "media_item"
            WHERE
                "media_item"."id"=$1
            "#,
            id
        )
        .try_map(|row| Ok(from_row!(MediaItem(row))))
        .fetch_one(conn)
        .await?)
    }

    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: &str,
        ids: &[String],
    ) -> Result<Vec<Self>> {
        Ok(sqlx::query!(
            r#"
            SELECT "media_item".*
            FROM "media_item"
                JOIN "user_catalog" USING ("catalog")
            WHERE
                "user_catalog"."user"=$1 AND
                "user_catalog"."writable" AND
                "media_item"."id"=ANY($2)
            "#,
            email,
            ids
        )
        .try_map(|row| Ok(from_row!(MediaItem(row))))
        .fetch_all(conn)
        .await?)
    }

    pub(crate) async fn update_media_files(conn: &mut DbConnection<'_>, catalog: &str) -> Result {
        let items = sqlx::query!(
            r#"
            SELECT
                "media_item".*,
                "latest_media_file"."id" AS "media_file_id",
                "latest_media_file"."uploaded" AS "media_file_uploaded",
                "latest_media_file"."file_name" AS "media_file_file_name",
                "latest_media_file"."file_size" AS "media_file_file_size",
                "latest_media_file"."mimetype" AS "media_file_mimetype",
                "latest_media_file"."width" AS "media_file_width",
                "latest_media_file"."height" AS "media_file_height",
                "latest_media_file"."duration" AS "media_file_duration",
                "latest_media_file"."frame_rate" AS "media_file_frame_rate",
                "latest_media_file"."bit_rate" AS "media_file_bit_rate",
                "latest_media_file"."filename" AS "media_file_filename",
                "latest_media_file"."title" AS "media_file_title",
                "latest_media_file"."description" AS "media_file_description",
                "latest_media_file"."label" AS "media_file_label",
                "latest_media_file"."category" AS "media_file_category",
                "latest_media_file"."location" AS "media_file_location",
                "latest_media_file"."city" AS "media_file_city",
                "latest_media_file"."state" AS "media_file_state",
                "latest_media_file"."country" AS "media_file_country",
                "latest_media_file"."make" AS "media_file_make",
                "latest_media_file"."model" AS "media_file_model",
                "latest_media_file"."lens" AS "media_file_lens",
                "latest_media_file"."photographer" AS "media_file_photographer",
                "latest_media_file"."orientation" AS "media_file_orientation",
                "latest_media_file"."iso" AS "media_file_iso",
                "latest_media_file"."rating" AS "media_file_rating",
                "latest_media_file"."longitude" AS "media_file_longitude",
                "latest_media_file"."latitude" AS "media_file_latitude",
                "latest_media_file"."altitude" AS "media_file_altitude",
                "latest_media_file"."aperture" AS "media_file_aperture",
                "latest_media_file"."focal_length" AS "media_file_focal_length",
                "latest_media_file"."taken" AS "media_file_taken",
                "latest_media_file"."media_item" AS "media_file_media_item",
                "latest_media_file"."shutter_speed" AS "media_file_shutter_speed",
                "latest_media_file"."needs_metadata" AS "media_file_needs_metadata",
                "latest_media_file"."stored" AS "media_file_stored"
            FROM "media_item"
                LEFT JOIN "latest_media_file" ON "media_item"."id"="latest_media_file"."media_item"
            WHERE
                "media_item"."catalog"=$1 AND
                "media_item"."media_file" IS DISTINCT FROM "latest_media_file"."id"
            "#,
            catalog
        )
        .try_map(|row| Ok((from_row!(MediaItem(row)), from_row!(MaybeMediaFile(row)))))
        .fetch_all(&mut *conn)
        .await?;

        let updated: Vec<MediaItem> = items
            .into_iter()
            .map(|(mut item, file)| {
                item.sync_with_file(file.as_ref());
                item
            })
            .collect();

        if !updated.is_empty() {
            Self::upsert(conn, &updated).await?;
            SavedSearch::update_for_catalog(conn, catalog).await?;
        }

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, media_items: &[MediaItem]) -> Result {
        if media_items.is_empty() {
            return Ok(());
        }

        for records in batch(media_items, 500) {
            let mut id = Vec::<String>::new();
            let mut deleted = Vec::<bool>::new();
            let mut created = Vec::<DateTime<Utc>>::new();
            let mut updated = Vec::<DateTime<Utc>>::new();
            let mut taken_zone = Vec::<Option<String>>::new();
            let mut catalog = Vec::<String>::new();
            let mut media_file = Vec::<Option<String>>::new();
            let mut datetime = Vec::<DateTime<Utc>>::new();
            let mut public = Vec::<bool>::new();
            let mut filename = Vec::<Option<String>>::new();
            let mut title = Vec::<Option<String>>::new();
            let mut description = Vec::<Option<String>>::new();
            let mut label = Vec::<Option<String>>::new();
            let mut category = Vec::<Option<String>>::new();
            let mut location = Vec::<Option<String>>::new();
            let mut city = Vec::<Option<String>>::new();
            let mut state = Vec::<Option<String>>::new();
            let mut country = Vec::<Option<String>>::new();
            let mut make = Vec::<Option<String>>::new();
            let mut model = Vec::<Option<String>>::new();
            let mut lens = Vec::<Option<String>>::new();
            let mut photographer = Vec::<Option<String>>::new();
            let mut shutter_speed = Vec::<Option<f32>>::new();
            let mut orientation = Vec::<Option<i32>>::new();
            let mut iso = Vec::<Option<i32>>::new();
            let mut rating = Vec::<Option<i32>>::new();
            let mut longitude = Vec::<Option<f32>>::new();
            let mut latitude = Vec::<Option<f32>>::new();
            let mut altitude = Vec::<Option<f32>>::new();
            let mut aperture = Vec::<Option<f32>>::new();
            let mut focal_length = Vec::<Option<f32>>::new();
            let mut taken = Vec::<Option<NaiveDateTime>>::new();

            records.iter().for_each(|media_item| {
                id.push(media_item.id.clone());
                deleted.push(media_item.deleted);
                created.push(media_item.created);
                updated.push(media_item.updated);
                taken_zone.push(media_item.taken_zone.clone());
                catalog.push(media_item.catalog.clone());
                media_file.push(media_item.media_file.clone());
                datetime.push(media_item.datetime);
                public.push(media_item.public);
                filename.push(media_item.metadata.filename.clone());
                title.push(media_item.metadata.title.clone());
                description.push(media_item.metadata.description.clone());
                label.push(media_item.metadata.label.clone());
                category.push(media_item.metadata.category.clone());
                location.push(media_item.metadata.location.clone());
                city.push(media_item.metadata.city.clone());
                state.push(media_item.metadata.state.clone());
                country.push(media_item.metadata.country.clone());
                make.push(media_item.metadata.make.clone());
                model.push(media_item.metadata.model.clone());
                lens.push(media_item.metadata.lens.clone());
                photographer.push(media_item.metadata.photographer.clone());
                shutter_speed.push(media_item.metadata.shutter_speed);
                orientation.push(media_item.metadata.orientation.map(|o| o.repr()));
                iso.push(media_item.metadata.iso);
                rating.push(media_item.metadata.rating);
                longitude.push(media_item.metadata.longitude);
                latitude.push(media_item.metadata.latitude);
                altitude.push(media_item.metadata.altitude);
                aperture.push(media_item.metadata.aperture);
                focal_length.push(media_item.metadata.focal_length);
                taken.push(media_item.metadata.taken);
            });

            sqlx::query!(
                r#"
                INSERT INTO "media_item" (
                    "id",
                    "deleted",
                    "created",
                    "updated",
                    "taken_zone",
                    "catalog",
                    "media_file",
                    "datetime",
                    "public",

                    "filename",
                    "title",
                    "description",
                    "label",
                    "category",
                    "location",
                    "city",
                    "state",
                    "country",
                    "make",
                    "model",
                    "lens",
                    "photographer",
                    "shutter_speed",
                    "orientation",
                    "iso",
                    "rating",
                    "longitude",
                    "latitude",
                    "altitude",
                    "aperture",
                    "focal_length",
                    "taken"
                )
                SELECT * FROM UNNEST(
                    $1::text[],
                    $2::bool[],
                    $3::timestamptz[],
                    $4::timestamptz[],
                    $5::text[],
                    $6::text[],
                    $7::text[],
                    $8::timestamptz[],
                    $9::bool[],

                    $10::text[],
                    $11::text[],
                    $12::text[],
                    $13::text[],
                    $14::text[],
                    $15::text[],
                    $16::text[],
                    $17::text[],
                    $18::text[],
                    $19::text[],
                    $20::text[],
                    $21::text[],
                    $22::text[],
                    $23::real[],
                    $24::integer[],
                    $25::integer[],
                    $26::integer[],
                    $27::real[],
                    $28::real[],
                    $29::real[],
                    $30::real[],
                    $31::real[],
                    $32::timestamp[]
                )
                ON CONFLICT (id) DO UPDATE SET
                    "deleted"="excluded"."deleted",
                    "created"="excluded"."created",
                    "updated"="excluded"."updated",
                    "taken_zone"="excluded"."taken_zone",
                    "catalog"="excluded"."catalog",
                    "media_file"="excluded"."media_file",
                    "datetime"="excluded"."datetime",
                    "public"="excluded"."public",

                    "filename"="excluded"."filename",
                    "title"="excluded"."title",
                    "description"="excluded"."description",
                    "label"="excluded"."label",
                    "category"="excluded"."category",
                    "location"="excluded"."location",
                    "city"="excluded"."city",
                    "state"="excluded"."state",
                    "country"="excluded"."country",
                    "make"="excluded"."make",
                    "model"="excluded"."model",
                    "lens"="excluded"."lens",
                    "photographer"="excluded"."photographer",
                    "shutter_speed"="excluded"."shutter_speed",
                    "orientation"="excluded"."orientation",
                    "iso"="excluded"."iso",
                    "rating"="excluded"."rating",
                    "longitude"="excluded"."longitude",
                    "latitude"="excluded"."latitude",
                    "altitude"="excluded"."altitude",
                    "aperture"="excluded"."aperture",
                    "focal_length"="excluded"."focal_length",
                    "taken"="excluded"."taken"
                "#,
                &id,
                &deleted,
                &created,
                &updated,
                &taken_zone as &[Option<String>],
                &catalog,
                &media_file as &[Option<String>],
                &datetime,
                &public,
                &filename as &[Option<String>],
                &title as &[Option<String>],
                &description as &[Option<String>],
                &label as &[Option<String>],
                &category as &[Option<String>],
                &location as &[Option<String>],
                &city as &[Option<String>],
                &state as &[Option<String>],
                &country as &[Option<String>],
                &make as &[Option<String>],
                &model as &[Option<String>],
                &lens as &[Option<String>],
                &photographer as &[Option<String>],
                &shutter_speed as &[Option<f32>],
                &orientation as &[Option<i32>],
                &iso as &[Option<i32>],
                &rating as &[Option<i32>],
                &longitude as &[Option<f32>],
                &latitude as &[Option<f32>],
                &altitude as &[Option<f32>],
                &aperture as &[Option<f32>],
                &focal_length as &[Option<f32>],
                &taken as &[Option<NaiveDateTime>]
            )
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
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

    pub(crate) fn path(&self) -> MediaItemStore {
        MediaItemStore {
            catalog: self.catalog.clone(),
            item: self.id.clone(),
        }
    }
}

#[derive(Clone, Debug)]
pub(crate) struct MediaFile {
    pub(crate) id: String,
    pub(crate) uploaded: DateTime<Utc>,
    pub(crate) file_name: String,
    pub(crate) file_size: i64,
    pub(crate) mimetype: Mime,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) duration: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) metadata: MediaMetadata,
    pub(crate) media_item: String,
    pub(crate) needs_metadata: bool,
    pub(crate) stored: Option<DateTime<Utc>>,
}

fn make_safe(name: &str) -> String {
    let matcher = Regex::new("[^a-zA-Z0-9_\\-\\.]").unwrap();
    matcher.replace(name, "_").to_string()
}

impl MediaFile {
    pub(crate) fn new(media_item: &str, file_name: &str, file_size: i64, mimetype: &Mime) -> Self {
        Self {
            id: short_id("I"),
            uploaded: Utc::now(),
            needs_metadata: true,
            stored: None,
            file_name: make_safe(file_name),
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

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn maybe(
        id: Option<String>,
        uploaded: Option<DateTime<Utc>>,
        file_name: Option<String>,
        file_size: Option<i64>,
        mimetype: Option<String>,
        width: Option<i32>,
        height: Option<i32>,
        duration: Option<f32>,
        frame_rate: Option<f32>,
        bit_rate: Option<f32>,
        media_item: Option<String>,
        needs_metadata: Option<bool>,
        stored: Option<DateTime<Utc>>,
        filename: Option<String>,
        title: Option<String>,
        description: Option<String>,
        label: Option<String>,
        category: Option<String>,
        location: Option<String>,
        city: Option<String>,
        state: Option<String>,
        country: Option<String>,
        make: Option<String>,
        model: Option<String>,
        lens: Option<String>,
        photographer: Option<String>,
        shutter_speed: Option<f32>,
        orientation: Option<i32>,
        iso: Option<i32>,
        rating: Option<i32>,
        longitude: Option<f32>,
        latitude: Option<f32>,
        altitude: Option<f32>,
        aperture: Option<f32>,
        focal_length: Option<f32>,
        taken: Option<NaiveDateTime>,
    ) -> SqlxResult<Option<Self>> {
        match (
            id,
            uploaded,
            file_name,
            file_size,
            mimetype,
            width,
            height,
            media_item,
            needs_metadata,
        ) {
            (
                Some(id),
                Some(uploaded),
                Some(file_name),
                Some(file_size),
                Some(mimetype),
                Some(width),
                Some(height),
                Some(media_item),
                Some(needs_metadata),
            ) => Ok(Some(Self {
                id,
                uploaded,
                needs_metadata,
                stored,
                file_name,
                file_size,
                mimetype: from_mime(&mimetype)?,
                width,
                height,
                duration,
                frame_rate,
                bit_rate,
                media_item,
                metadata: MediaMetadata {
                    filename,
                    title,
                    description,
                    label,
                    category,
                    location,
                    city,
                    state,
                    country,
                    make,
                    model,
                    lens,
                    photographer,
                    shutter_speed,
                    orientation: orientation.and_then(Orientation::from_repr),
                    iso,
                    rating,
                    longitude,
                    latitude,
                    altitude,
                    aperture,
                    focal_length,
                    taken,
                },
            })),
            _ => Ok(None),
        }
    }

    pub(crate) async fn mark_stored(&mut self, conn: &mut DbConnection<'_>) -> Result {
        self.stored = Some(Utc::now());

        *self = sqlx::query!(
            r#"
            UPDATE "media_file" SET
                "stored"=$1,
                "file_size"=$2,
                "width"=$3,
                "height"=$4,
                "mimetype"=$5,
                "duration"=$6,
                "frame_rate"=$7,
                "bit_rate"=$8
            WHERE "id"=$9
            RETURNING *
            "#,
            self.stored,
            self.file_size,
            self.width,
            self.height,
            self.mimetype.to_string(),
            self.duration,
            self.frame_rate,
            self.bit_rate,
            self.id,
        )
        .try_map(|row| Ok(from_row!(MediaFile(row))))
        .fetch_one(conn)
        .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_for_items(
        conn: &mut DbConnection<'_>,
        items: &[String],
    ) -> Result<Vec<(MediaFile, MediaFileStore)>> {
        let files = sqlx::query!(
            r#"
            SELECT "media_file".*, "media_item"."catalog"
            FROM "media_file"
                JOIN "media_item" ON "media_item"."media_file"="media_file"."id"
            WHERE
                "media_item"."id"=ANY($1) AND
                NOT "media_item"."deleted"
            "#,
            items
        )
        .try_map(|row| Ok((from_row!(MediaFile(row)), row.catalog)))
        .fetch_all(conn)
        .await?;

        Ok(files
            .into_iter()
            .map(|(media_file, catalog)| {
                let media_file_store = MediaFileStore {
                    catalog,
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                };
                (media_file, media_file_store)
            })
            .collect())
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_newest(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(MediaFile, MediaFileStore)>> {
        let files = sqlx::query!(
            r#"
            SELECT DISTINCT ON ("media_file"."media_item") "media_file".*
            FROM "media_file"
                JOIN "media_item" ON "media_item"."media_file"="media_file"."id"
            WHERE
                "media_item"."catalog"=$1 AND
                NOT "media_item"."deleted"
            ORDER BY "media_file"."media_item", "media_file"."uploaded" DESC
            "#,
            catalog
        )
        .try_map(|row| Ok(from_row!(MediaFile(row))))
        .fetch_all(conn)
        .await?;

        Ok(files
            .into_iter()
            .map(|media_file| {
                let media_file_store = MediaFileStore {
                    catalog: catalog.to_owned(),
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                };
                (media_file, media_file_store)
            })
            .collect())
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_for_item(
        conn: &mut DbConnection<'_>,
        item: &str,
    ) -> Result<Vec<(MediaFile, MediaFileStore)>> {
        Ok(sqlx::query!(
            r#"
            SELECT "media_file".*, "media_item"."catalog"
            FROM "media_file"
                JOIN "media_item" ON "media_item"."id"="media_file"."media_item"
            WHERE
                "media_item"."id"=$1
            ORDER BY "media_file"."uploaded" DESC
            "#,
            item
        )
        .try_map(|row| {
            Ok((
                from_row!(MediaFile(row)),
                MediaFileStore {
                    catalog: row.catalog,
                    item: row.media_item,
                    file: row.id,
                },
            ))
        })
        .fetch_all(conn)
        .await?)
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_needs_processing(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<String>> {
        Ok(sqlx::query_scalar!(
            r#"
            SELECT DISTINCT ON ("media_file"."media_item") "media_file"."id"
            FROM "media_file"
                JOIN "media_item" ON "media_item"."id"="media_file"."media_item"
            WHERE
                "media_item"."catalog"=$1 AND
                NOT "media_item"."deleted" AND
                (
                    "media_file"."stored" IS NULL OR
                    "media_file"."needs_metadata" OR
                    "media_file"."id" IN (
                        SELECT "media_file"
                        FROM "alternate_file"
                        WHERE "stored" IS NULL
                    )
                )
            ORDER BY "media_file"."media_item", "media_file"."uploaded" DESC
            "#,
            catalog
        )
        .fetch_all(conn)
        .await?)
    }

    #[instrument(skip_all)]
    pub(crate) async fn list_prunable(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(MediaFile, MediaFileStore)>> {
        let files = sqlx::query!(
            r#"
            SELECT "media_file".*
            FROM "media_file"
                JOIN "media_item" ON "media_item"."id"="media_file"."media_item"
                JOIN "media_file" AS "current_file" ON "current_file"."id"="media_item"."media_file"
            WHERE
                "media_item"."catalog"=$1 AND
                "media_file"."id" <> "current_file"."id" AND
                "media_file"."uploaded" < "current_file"."uploaded"
            "#,
            catalog
        )
        .try_map(|row| Ok(from_row!(MediaFile(row))))
        .fetch_all(conn)
        .await?;

        Ok(files
            .into_iter()
            .map(|media_file| {
                let media_file_store = MediaFileStore {
                    catalog: catalog.to_owned(),
                    item: media_file.media_item.clone(),
                    file: media_file.id.clone(),
                };
                (media_file, media_file_store)
            })
            .collect())
    }

    pub(crate) async fn list_for_catalog(
        conn: &mut DbConnection<'_>,
        catalog: &str,
    ) -> Result<Vec<(MediaFile, MediaFileStore)>> {
        let files = sqlx::query!(
            r#"
            SELECT "media_file".*
            FROM "media_file"
                JOIN "media_item" ON "media_file"."media_item"="media_item"."id"
            WHERE "media_item"."catalog"=$1
            "#,
            catalog
        )
        .try_map(|row| Ok(from_row!(MediaFile(row))))
        .fetch_all(conn)
        .await?;

        Ok(files
            .into_iter()
            .map(|media_file| {
                let file_path = MediaFileStore {
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
        email: Option<&str>,
        media: &str,
        file: &str,
    ) -> Result<(MediaFile, MediaFileStore)> {
        let email = email.unwrap_or_default().to_owned();

        let (media_file, catalog) = sqlx::query!(
            r#"
            SELECT "media_file".*, "media_item"."catalog"
            FROM "media_file"
                JOIN "media_item" ON "media_item"."id"="media_file"."media_item"
            WHERE
                NOT "media_item"."deleted" AND
                "media_item"."id"=$1 AND
                "media_file"."id"=$2 AND
                (
                    "media_item"."id" IN (
                        SELECT "media_search"."media"
                        FROM "saved_search"
                            JOIN "media_search" ON "media_search"."search"="saved_search"."id"
                        WHERE "saved_search"."shared"
                    ) OR
                    "media_item"."catalog" IN (
                        SELECT "catalog"
                        FROM "user_catalog"
                        WHERE "user"=$3
                    )
                )
            "#,
            media,
            file,
            email
        )
        .try_map(|row| Ok((from_row!(MediaFile(row)), row.catalog)))
        .fetch_one(conn)
        .await?;

        let file_path = MediaFileStore {
            catalog,
            item: media.to_owned(),
            file: file.to_owned(),
        };
        Ok((media_file, file_path))
    }

    pub(crate) async fn get(
        conn: &mut DbConnection<'_>,
        id: &str,
    ) -> Result<(MediaFile, MediaFileStore)> {
        let (media_file, catalog) = sqlx::query!(
            r#"
            SELECT "media_file".*, "media_item"."catalog"
            FROM "media_file"
                JOIN "media_item" ON "media_item"."id"="media_file"."media_item"
            WHERE
                "media_file"."id"=$1
            "#,
            id
        )
        .try_map(|row| Ok((from_row!(MediaFile(row)), row.catalog)))
        .fetch_one(conn)
        .await?;

        let file_path = MediaFileStore {
            catalog,
            item: media_file.media_item.clone(),
            file: media_file.id.clone(),
        };

        Ok((media_file, file_path))
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(conn: &mut DbConnection<'_>, media_files: &[MediaFile]) -> Result {
        if media_files.is_empty() {
            return Ok(());
        }

        let media_file_map: HashMap<String, &MediaFile> =
            media_files.iter().map(|m| (m.id.clone(), m)).collect();
        let media_file_ids: Vec<String> = media_file_map.keys().cloned().collect();

        let mut items = sqlx::query!(
            r#"
            SELECT *
            FROM "media_item"
            WHERE "media_file"=ANY($1)
            "#,
            &media_file_ids
        )
        .map(|row| from_row!(MediaItem(row)))
        .fetch_all(&mut *conn)
        .await?;

        items.iter_mut().for_each(|item| {
            if let Some(file) = item.media_file.as_ref().and_then(|f| media_file_map.get(f)) {
                item.sync_with_file(Some(file));
            }
        });

        for records in batch(media_files, 500) {
            let mut id = Vec::<String>::new();
            let mut uploaded = Vec::<DateTime<Utc>>::new();
            let mut file_name = Vec::<String>::new();
            let mut file_size = Vec::<i64>::new();
            let mut mimetype = Vec::<String>::new();
            let mut width = Vec::<i32>::new();
            let mut height = Vec::<i32>::new();
            let mut duration = Vec::<Option<f32>>::new();
            let mut frame_rate = Vec::<Option<f32>>::new();
            let mut bit_rate = Vec::<Option<f32>>::new();
            let mut media_item = Vec::<String>::new();
            let mut needs_metadata = Vec::<bool>::new();
            let mut stored = Vec::<Option<DateTime<Utc>>>::new();

            let mut filename = Vec::<Option<String>>::new();
            let mut title = Vec::<Option<String>>::new();
            let mut description = Vec::<Option<String>>::new();
            let mut label = Vec::<Option<String>>::new();
            let mut category = Vec::<Option<String>>::new();
            let mut location = Vec::<Option<String>>::new();
            let mut city = Vec::<Option<String>>::new();
            let mut state = Vec::<Option<String>>::new();
            let mut country = Vec::<Option<String>>::new();
            let mut make = Vec::<Option<String>>::new();
            let mut model = Vec::<Option<String>>::new();
            let mut lens = Vec::<Option<String>>::new();
            let mut photographer = Vec::<Option<String>>::new();
            let mut shutter_speed = Vec::<Option<f32>>::new();
            let mut orientation = Vec::<Option<i32>>::new();
            let mut iso = Vec::<Option<i32>>::new();
            let mut rating = Vec::<Option<i32>>::new();
            let mut longitude = Vec::<Option<f32>>::new();
            let mut latitude = Vec::<Option<f32>>::new();
            let mut altitude = Vec::<Option<f32>>::new();
            let mut aperture = Vec::<Option<f32>>::new();
            let mut focal_length = Vec::<Option<f32>>::new();
            let mut taken = Vec::<Option<NaiveDateTime>>::new();

            records.iter().for_each(|media_file| {
                id.push(media_file.id.clone());
                uploaded.push(media_file.uploaded);
                file_name.push(media_file.file_name.clone());
                file_size.push(media_file.file_size);
                mimetype.push(media_file.mimetype.to_string());
                width.push(media_file.width);
                height.push(media_file.height);
                duration.push(media_file.duration);
                frame_rate.push(media_file.frame_rate);
                bit_rate.push(media_file.bit_rate);
                media_item.push(media_file.media_item.clone());
                needs_metadata.push(media_file.needs_metadata);
                stored.push(media_file.stored);

                filename.push(media_file.metadata.filename.clone());
                title.push(media_file.metadata.title.clone());
                description.push(media_file.metadata.description.clone());
                label.push(media_file.metadata.label.clone());
                category.push(media_file.metadata.category.clone());
                location.push(media_file.metadata.location.clone());
                city.push(media_file.metadata.city.clone());
                state.push(media_file.metadata.state.clone());
                country.push(media_file.metadata.country.clone());
                make.push(media_file.metadata.make.clone());
                model.push(media_file.metadata.model.clone());
                lens.push(media_file.metadata.lens.clone());
                photographer.push(media_file.metadata.photographer.clone());
                shutter_speed.push(media_file.metadata.shutter_speed);
                orientation.push(media_file.metadata.orientation.map(|o| o.repr()));
                iso.push(media_file.metadata.iso);
                rating.push(media_file.metadata.rating);
                longitude.push(media_file.metadata.longitude);
                latitude.push(media_file.metadata.latitude);
                altitude.push(media_file.metadata.altitude);
                aperture.push(media_file.metadata.aperture);
                focal_length.push(media_file.metadata.focal_length);
                taken.push(media_file.metadata.taken);
            });

            sqlx::query!(
                r#"
                INSERT INTO media_file (
                    "id",
                    "uploaded",
                    "file_name",
                    "file_size",
                    "mimetype",
                    "width",
                    "height",
                    "duration",
                    "frame_rate",
                    "bit_rate",
                    "media_item",
                    "needs_metadata",
                    "stored",

                    "filename",
                    "title",
                    "description",
                    "label",
                    "category",
                    "location",
                    "city",
                    "state",
                    "country",
                    "make",
                    "model",
                    "lens",
                    "photographer",
                    "shutter_speed",
                    "orientation",
                    "iso",
                    "rating",
                    "longitude",
                    "latitude",
                    "altitude",
                    "aperture",
                    "focal_length",
                    "taken"
                )
                SELECT * FROM UNNEST(
                    $1::text[],
                    $2::timestamptz[],
                    $3::text[],
                    $4::bigint[],
                    $5::text[],
                    $6::integer[],
                    $7::integer[],
                    $8::real[],
                    $9::real[],
                    $10::real[],
                    $11::text[],
                    $12::bool[],
                    $13::timestamptz[],

                    $14::text[],
                    $15::text[],
                    $16::text[],
                    $17::text[],
                    $18::text[],
                    $19::text[],
                    $20::text[],
                    $21::text[],
                    $22::text[],
                    $23::text[],
                    $24::text[],
                    $25::text[],
                    $26::text[],
                    $27::real[],
                    $28::integer[],
                    $29::integer[],
                    $30::integer[],
                    $31::real[],
                    $32::real[],
                    $33::real[],
                    $34::real[],
                    $35::real[],
                    $36::timestamp[]
                )
                ON CONFLICT (id) DO UPDATE SET
                    "uploaded"="excluded"."uploaded",
                    "file_name"="excluded"."file_name",
                    "file_size"="excluded"."file_size",
                    "mimetype"="excluded"."mimetype",
                    "width"="excluded"."width",
                    "height"="excluded"."height",
                    "duration"="excluded"."duration",
                    "frame_rate"="excluded"."frame_rate",
                    "bit_rate"="excluded"."bit_rate",
                    "media_item"="excluded"."media_item",
                    "needs_metadata"="excluded"."needs_metadata",

                    "stored"="excluded"."stored",
                    "filename"="excluded"."filename",
                    "title"="excluded"."title",
                    "description"="excluded"."description",
                    "label"="excluded"."label",
                    "category"="excluded"."category",
                    "location"="excluded"."location",
                    "city"="excluded"."city",
                    "state"="excluded"."state",
                    "country"="excluded"."country",
                    "make"="excluded"."make",
                    "model"="excluded"."model",
                    "lens"="excluded"."lens",
                    "photographer"="excluded"."photographer",
                    "shutter_speed"="excluded"."shutter_speed",
                    "orientation"="excluded"."orientation",
                    "iso"="excluded"."iso",
                    "rating"="excluded"."rating",
                    "longitude"="excluded"."longitude",
                    "latitude"="excluded"."latitude",
                    "altitude"="excluded"."altitude",
                    "aperture"="excluded"."aperture",
                    "focal_length"="excluded"."focal_length",
                    "taken"="excluded"."taken"
                "#,
                &id,
                &uploaded,
                &file_name,
                &file_size,
                &mimetype,
                &width,
                &height,
                &duration as &[Option<f32>],
                &frame_rate as &[Option<f32>],
                &bit_rate as &[Option<f32>],
                &media_item,
                &needs_metadata,
                &stored as &[Option<DateTime<Utc>>],
                &filename as &[Option<String>],
                &title as &[Option<String>],
                &description as &[Option<String>],
                &label as &[Option<String>],
                &category as &[Option<String>],
                &location as &[Option<String>],
                &city as &[Option<String>],
                &state as &[Option<String>],
                &country as &[Option<String>],
                &make as &[Option<String>],
                &model as &[Option<String>],
                &lens as &[Option<String>],
                &photographer as &[Option<String>],
                &shutter_speed as &[Option<f32>],
                &orientation as &[Option<i32>],
                &iso as &[Option<i32>],
                &rating as &[Option<i32>],
                &longitude as &[Option<f32>],
                &latitude as &[Option<f32>],
                &altitude as &[Option<f32>],
                &aperture as &[Option<f32>],
                &focal_length as &[Option<f32>],
                &taken as &[Option<NaiveDateTime>]
            )
            .execute(&mut *conn)
            .await?;
        }

        MediaItem::upsert(conn, &items).await?;

        Ok(())
    }

    pub(crate) async fn delete(conn: &mut DbConnection<'_>, ids: &[String]) -> Result {
        for records in batch(ids, 500) {
            sqlx::query!(
                r#"
                DELETE FROM "media_file"
                WHERE "id"=ANY($1)
                "#,
                records
            )
            .execute(&mut *conn)
            .await?;
        }

        Ok(())
    }
}

#[derive(Clone, Debug)]
pub(crate) struct AlternateFile {
    pub(crate) id: String,
    pub(crate) file_type: AlternateFileType,
    pub(crate) file_name: String,
    pub(crate) file_size: i64,
    pub(crate) mimetype: Mime,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) duration: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) media_file: String,
    pub(crate) local: bool,
    pub(crate) stored: Option<DateTime<Utc>>,
}

impl AlternateFile {
    pub(crate) fn new(media_file: &str, alternate: Alternate) -> Self {
        Self {
            id: short_id("F"),
            file_type: alternate.alt_type,
            file_name: alternate.file_name.clone(),
            file_size: 0,
            mimetype: alternate.mimetype,
            width: alternate.size.unwrap_or_default(),
            height: alternate.size.unwrap_or_default(),
            duration: None,
            frame_rate: None,
            bit_rate: None,
            media_file: media_file.to_owned(),
            local: alternate.alt_type.is_local(),
            stored: None,
        }
    }

    pub(crate) async fn get_social<'c, D: AsDb<'c>>(
        mut conn: D,
        media_item: &str,
    ) -> Result<(Self, FilePath)> {
        let (alternate, catalog) = sqlx::query!(
            r#"
            SELECT "alternate_file".*, "media_item"."catalog"
            FROM "alternate_file"
                JOIN "media_file" ON "media_file"."id"="alternate_file"."media_file"
                JOIN "media_item" ON "media_item"."media_file"="media_file"."id"
            WHERE
                (
                    "media_item"."public" OR
                    "media_item" IN (
                        SELECT "media_search"."media"
                        FROM "media_search"
                            JOIN "saved_search" ON "saved_search"."id"="media_search"."search"
                        WHERE "saved_search"."shared"
                    )
                ) AND
                "alternate_file"."type"='social' AND
                "media_item"."id"=$1 AND
                "alternate_file"."stored" IS NOT NULL
            "#,
            media_item
        )
        .try_map(|row| Ok((from_row!(AlternateFile(row)), row.catalog)))
        .fetch_one(conn.as_db())
        .await?;

        let path = FilePath {
            catalog,
            item: media_item.to_owned(),
            file: alternate.media_file.clone(),
            file_name: alternate.file_name.clone(),
        };

        Ok((alternate, path))
    }

    pub(crate) async fn sync_for_media_files(
        conn: &mut DbConnection<'_>,
        media_files: Vec<(MediaFile, MediaFileStore, Vec<Alternate>)>,
    ) -> Result {
        // Mapped by media_file ID.
        let mut existing_alternates: HashMap<String, Vec<AlternateFile>> = HashMap::new();

        {
            let file_ids = media_files
                .iter()
                .map(|(mf, _, _)| mf.id.clone())
                .collect_vec();

            sqlx::query!(
                r#"
                SELECT *
                FROM "alternate_file"
                WHERE "media_file"=ANY($1)
                "#,
                &file_ids
            )
            .try_map(|row| Ok(from_row!(AlternateFile(row))))
            .fetch_all(&mut *conn)
            .await?
            .into_iter()
            .for_each(|af| {
                existing_alternates
                    .entry(af.media_file.clone())
                    .or_default()
                    .push(af)
            });
        }

        let mut to_delete: Vec<String> = Vec::new();
        let mut to_create: Vec<AlternateFile> = Vec::new();

        for (media_file, _, wanted_alternates) in media_files {
            let mut wanted_alternates: HashSet<Alternate> = wanted_alternates.into_iter().collect();

            if let Some(existing_alternates) = existing_alternates.get(&media_file.id) {
                for af in existing_alternates {
                    let len = wanted_alternates.len();
                    wanted_alternates.retain(|a| !a.matches(af));

                    // Unchanged means nothing matched so this alternate file is not wanted.
                    if len == wanted_alternates.len() {
                        to_delete.push(af.id.clone());
                    }
                }
            }

            if !wanted_alternates.is_empty() {
                conn.queue_task(Task::ProcessMediaFile {
                    media_file: media_file.id.clone(),
                })
                .await;
            }

            to_create.extend(
                wanted_alternates
                    .into_iter()
                    .map(|a| AlternateFile::new(&media_file.id, a)),
            );
        }

        if !to_delete.is_empty() {
            conn.queue_task(Task::DeleteAlternateFiles {
                alternate_files: to_delete,
            })
            .await;
        }

        AlternateFile::upsert(conn, &to_create).await
    }

    pub(crate) async fn list_for_media_file(
        conn: &mut DbConnection<'_>,
        media_file: &str,
    ) -> Result<Vec<AlternateFile>> {
        Ok(sqlx::query!(
            r#"
            SELECT *
            FROM "alternate_file"
            WHERE "media_file"=$1
            "#,
            media_file
        )
        .try_map(|row| Ok(from_row!(AlternateFile(row))))
        .fetch_all(conn)
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
        let email = email.unwrap_or_default().to_owned();

        let files = sqlx::query!(
            r#"
            SELECT "alternate_file".*, "media_item"."id" AS "media_item", "media_item"."catalog"
            FROM "media_item"
                LEFT JOIN "media_search" ON "media_search"."media"="media_item"."id"
                JOIN "alternate_file" USING ("media_file")
            WHERE
                "media_item"."id"=$1 AND
                "media_item"."media_file"=$2 AND
                "alternate_file"."mimetype"=$3 AND
                "alternate_file"."type"=$4 AND
                (
                    "media_item"."public" OR
                    "media_search"."search" IN (
                        SELECT "id"
                        FROM "saved_search"
                        WHERE "shared"
                    ) OR
                    "media_item"."catalog" IN (
                        SELECT "catalog"
                        FROM "user_catalog"
                        WHERE "user"=$5
                    )
                )
            "#,
            item,
            file,
            &mimetype.to_string(),
            &alternate_type.to_string(),
            email
        )
        .try_map(|row| Ok((from_row!(AlternateFile(row)), row.media_item, row.catalog)))
        .fetch_all(conn)
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

        Ok(vec![])
    }

    pub(crate) async fn mark_stored(&mut self, conn: &mut DbConnection<'_>) -> Result {
        self.stored = Some(Utc::now());

        *self = sqlx::query!(
            r#"
            UPDATE "alternate_file"
            SET
                "stored"=$1,
                "file_size"=$2,
                "width"=$3,
                "height"=$4,
                "mimetype"=$5,
                "duration"=$6,
                "frame_rate"=$7,
                "bit_rate"=$8
            WHERE "id"=$9
            RETURNING *
            "#,
            self.stored,
            self.file_size,
            self.width,
            self.height,
            self.mimetype.to_string(),
            self.duration,
            self.frame_rate,
            self.bit_rate,
            self.id,
        )
        .try_map(|row| Ok(from_row!(AlternateFile(row))))
        .fetch_one(conn)
        .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn delete(conn: &mut DbConnection<'_>, alternate_files: &[String]) -> Result {
        sqlx::query!(
            r#"
            DELETE FROM "alternate_file"
            WHERE "id"=ANY($1)
            "#,
            alternate_files
        )
        .execute(conn)
        .await?;

        Ok(())
    }

    #[instrument(skip_all)]
    pub(crate) async fn upsert(
        conn: &mut DbConnection<'_>,
        alternate_files: &[AlternateFile],
    ) -> Result {
        if alternate_files.is_empty() {
            return Ok(());
        }

        for records in batch(alternate_files, 500) {
            let mut id = Vec::<String>::new();
            let mut file_type = Vec::<String>::new();
            let mut file_name = Vec::<String>::new();
            let mut file_size = Vec::<i64>::new();
            let mut mimetype = Vec::<String>::new();
            let mut width = Vec::<i32>::new();
            let mut height = Vec::<i32>::new();
            let mut duration = Vec::<Option<f32>>::new();
            let mut frame_rate = Vec::<Option<f32>>::new();
            let mut bit_rate = Vec::<Option<f32>>::new();
            let mut media_file = Vec::<String>::new();
            let mut local = Vec::<bool>::new();
            let mut stored = Vec::<Option<DateTime<Utc>>>::new();

            records.iter().for_each(|alternate_file| {
                id.push(alternate_file.id.clone());
                file_type.push(alternate_file.file_type.to_string());
                file_name.push(alternate_file.file_name.clone());
                file_size.push(alternate_file.file_size);
                mimetype.push(alternate_file.mimetype.to_string());
                width.push(alternate_file.width);
                height.push(alternate_file.height);
                duration.push(alternate_file.duration);
                frame_rate.push(alternate_file.frame_rate);
                bit_rate.push(alternate_file.bit_rate);
                media_file.push(alternate_file.media_file.clone());
                local.push(alternate_file.local);
                stored.push(alternate_file.stored);
            });

            sqlx::query!(
                r#"
                INSERT INTO alternate_file (
                    "id",
                    "type",
                    "file_name",
                    "file_size",
                    "mimetype",
                    "width",
                    "height",
                    "duration",
                    "frame_rate",
                    "bit_rate",
                    "media_file",
                    "local",
                    "stored"
                )
                SELECT * FROM UNNEST(
                    $1::text[],
                    $2::text[],
                    $3::text[],
                    $4::bigint[],
                    $5::text[],
                    $6::integer[],
                    $7::integer[],
                    $8::real[],
                    $9::real[],
                    $10::real[],
                    $11::text[],
                    $12::bool[],
                    $13::timestamptz[]
                )
                ON CONFLICT (id) DO UPDATE SET
                    "type"="excluded"."type",
                    "file_name"="excluded"."file_name",
                    "file_size"="excluded"."file_size",
                    "mimetype"="excluded"."mimetype",
                    "width"="excluded"."width",
                    "height"="excluded"."height",
                    "duration"="excluded"."duration",
                    "frame_rate"="excluded"."frame_rate",
                    "bit_rate"="excluded"."bit_rate",
                    "local"="excluded"."local",
                    "stored"="excluded"."stored"
                "#,
                &id,
                &file_type,
                &file_name,
                &file_size,
                &mimetype,
                &width,
                &height,
                &duration as &[Option<f32>],
                &frame_rate as &[Option<f32>],
                &bit_rate as &[Option<f32>],
                &media_file,
                &local,
                &stored as &[Option<DateTime<Utc>>],
            )
            .execute(&mut *conn)
            .await?;
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

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaViewFile {
    pub(crate) id: String,
    pub(crate) file_size: i64,
    #[serde(with = "crate::shared::mime")]
    pub(crate) mimetype: Mime,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) duration: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) uploaded: DateTime<Utc>,
    pub(crate) file_name: String,
    pub(crate) alternates: Vec<MediaViewFileAlternate>,
}

impl MediaViewFile {
    #[allow(clippy::too_many_arguments)]
    pub(super) fn from_maybe(
        id: Option<String>,
        file_size: Option<i64>,
        mimetype: Option<String>,
        width: Option<i32>,
        height: Option<i32>,
        duration: Option<f32>,
        frame_rate: Option<f32>,
        bit_rate: Option<f32>,
        uploaded: Option<DateTime<Utc>>,
        file_name: Option<String>,
        alternates: Option<Value>,
    ) -> SqlxResult<Option<Self>> {
        match (
            id, file_size, mimetype, width, height, uploaded, file_name, alternates,
        ) {
            (
                Some(id),
                Some(file_size),
                Some(mimetype),
                Some(width),
                Some(height),
                Some(uploaded),
                Some(file_name),
                Some(alternates),
            ) => {
                let alternates: Vec<MediaViewFileAlternate> =
                    match serde_json::from_value(alternates) {
                        Ok(a) => a,
                        Err(e) => {
                            error!(error = %e, "Invalid alternate media JSON in media_view");
                            Vec::new()
                        }
                    };

                Ok(Some(Self {
                    id,
                    file_size,
                    mimetype: from_mime(&mimetype)?,
                    width,
                    height,
                    bit_rate,
                    duration,
                    frame_rate,
                    uploaded,
                    file_name,
                    alternates,
                }))
            }
            _ => Ok(None),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaView {
    pub(crate) id: String,
    pub(crate) catalog: String,
    pub(crate) created: DateTime<Utc>,
    pub(crate) updated: DateTime<Utc>,
    pub(crate) datetime: DateTime<Utc>,
    pub(crate) public: bool,
    #[serde(flatten)]
    pub(crate) metadata: MediaMetadata,
    pub(crate) taken_zone: Option<String>,
    pub(crate) file: Option<MediaViewFile>,
}

impl MediaView {
    pub(crate) fn amend_for_access(&mut self, access: MediaAccess) {
        if access == MediaAccess::PublicMedia {
            self.metadata.longitude = None;
            self.metadata.latitude = None;
            self.metadata.altitude = None;
            self.metadata.location = None;
        }
    }
}

impl<'r> FromRow<'r, PgRow> for MediaView {
    fn from_row(row: &'r PgRow) -> SqlxResult<MediaView> {
        Ok(MediaView {
            id: row.try_get("id")?,
            catalog: row.try_get("catalog")?,
            created: row.try_get("created")?,
            updated: row.try_get("updated")?,
            datetime: row.try_get("datetime")?,
            public: row.try_get("public")?,
            taken_zone: row.try_get("taken_zone")?,
            metadata: MediaMetadata::from_row(row)?,
            file: MediaViewFile::from_maybe(
                row.try_get("media_file")?,
                row.try_get("file_size")?,
                row.try_get("mimetype")?,
                row.try_get("width")?,
                row.try_get("height")?,
                row.try_get("duration")?,
                row.try_get("frame_rate")?,
                row.try_get("bit_rate")?,
                row.try_get("uploaded")?,
                row.try_get("file_name")?,
                row.try_get("alternates")?,
            )?,
        })
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct AlbumRelation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) id: Option<String>,
    pub(crate) name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct TagRelation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) id: Option<String>,
    pub(crate) name: String,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, sqlx::Type)]
#[sqlx(type_name = "location")]
pub(crate) struct Location {
    pub(crate) left: f32,
    pub(crate) right: f32,
    pub(crate) top: f32,
    pub(crate) bottom: f32,
}

// impl<'q> Encode<'q, SqlxDatabase> for Location {
//     fn encode_by_ref(
//         &self,
//         buf: &mut <SqlxDatabase as Database>::ArgumentBuffer<'q>,
//     ) -> result::Result<IsNull, sqlx::error::BoxDynError> {
//         let slice = [self.left, self.right, self.top, self.bottom];
//         slice.encode_by_ref(buf)
//     }

//     fn produces(&self) -> Option<<SqlxDatabase as Database>::TypeInfo> {
//         Some(PgTypeInfo::with_name("location"))
//     }
// }

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct PersonRelation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) id: Option<String>,
    pub(crate) name: String,
    pub(crate) location: Option<Location>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub(crate) struct SearchRelation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) id: Option<String>,
    pub(crate) name: String,
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

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Relations {
    pub(crate) albums: Vec<AlbumRelation>,
    pub(crate) tags: Vec<TagRelation>,
    pub(crate) people: Vec<PersonRelation>,
    pub(crate) searches: Vec<SearchRelation>,
}

fn decoded<T>(data: Option<Value>) -> SqlxResult<Vec<T>>
where
    T: DeserializeOwned,
{
    match data {
        Some(v) => from_value(v).map_err(|e| SqlxError::Decode(Box::new(e))),
        None => Ok(Vec::new()),
    }
}

impl Relations {
    fn decode(
        albums: Option<Value>,
        tags: Option<Value>,
        people: Option<Value>,
        searches: Option<Value>,
    ) -> SqlxResult<Self> {
        Ok(Self {
            albums: decoded(albums)?,
            tags: decoded(tags)?,
            people: decoded(people)?,
            searches: decoded(searches)?,
        })
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaRelations {
    #[serde(flatten)]
    pub(crate) media: MediaView,
    pub(crate) access: MediaAccess,
    #[serde(flatten)]
    pub(crate) relations: Relations,
}

impl MediaRelations {
    pub(crate) async fn get_for_user(
        conn: &mut DbConnection<'_>,
        email: Option<&str>,
        search: Option<&str>,
        media: &[String],
    ) -> Result<Vec<MediaRelations>> {
        let email = email.unwrap_or_default().to_owned();

        let media = sqlx::query!(
            r#"
            SELECT
                "media_view".*,
                "user_catalog"."writable",
                "album_relation"."albums",
                "tag_relation"."tags",
                "person_relation"."people",
                "search_relation"."searches",
                "media_view"."id" IN (
                    SELECT "media_search"."media"
                    FROM "saved_search"
                        JOIN "media_search" ON "media_search"."search"="saved_search"."id"
                    WHERE "saved_search"."shared" AND
                    (
                        "saved_search"."id"=$1 OR
                        $1 IS NULL
                    )
                ) AS "in_public_search"
            FROM "media_view"
                LEFT JOIN "user_catalog" ON "user_catalog"."catalog"="media_view"."catalog" AND "user_catalog"."user"=$2
                LEFT JOIN "album_relation" ON "album_relation"."media"="media_view"."id"
                LEFT JOIN "tag_relation" ON "tag_relation"."media"="media_view"."id"
                LEFT JOIN "person_relation" ON "person_relation"."media"="media_view"."id"
                LEFT JOIN "search_relation" ON "search_relation"."media"="media_view"."id"
            WHERE "media_view"."id"=ANY($3)
            "#,
            search,
            email,
            media
        ).try_map(|row| Ok((
            from_row!(MediaView(row)),
            row.writable,
            from_row!(Relations(row)),
            row.in_public_search.unwrap_or_default()
        ))).fetch_all(conn).await?;

        Ok(media
            .into_iter()
            .filter_map(|(mut media, writable, mut relations, in_public_search)| {
                let access = match (writable, media.public, search.is_some(), in_public_search) {
                    (Some(true), _, _, _) => MediaAccess::WritableCatalog,
                    (Some(false), _, _, _) => MediaAccess::ReadableCatalog,
                    (_, _, true, true) => MediaAccess::PublicSearch,
                    (_, true, _, _) => MediaAccess::PublicMedia,
                    _ => return None,
                };

                media.amend_for_access(access);

                if matches!(access, MediaAccess::PublicSearch | MediaAccess::PublicMedia) {
                    relations.tags.iter_mut().for_each(|r| r.id = None);
                    relations.albums = vec![];
                    relations.searches = vec![];

                    if access == MediaAccess::PublicMedia {
                        relations.people = vec![];
                    }
                }

                Some(MediaRelations {
                    media,
                    access,
                    relations,
                })
            })
            .collect())
    }
}
