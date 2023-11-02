pub(crate) mod functions;
pub(crate) mod search;

use std::path::PathBuf;

use async_trait::async_trait;
use diesel::{
    dsl::count,
    migration::{Migration, MigrationSource},
    pg::Pg,
    prelude::*,
};
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    scoped_futures::ScopedFutureExt,
    AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection,
};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use time::OffsetDateTime;
use tracing::{info, instrument, trace};

use crate::{joinable, models, schema::*, MediaFilePath, RemotePath, Result};
use pixelbin_shared::Error;

pub(crate) type DbConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<DbConnection>;

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations");

#[instrument(err)]
pub(crate) async fn connect(db_url: &str) -> Result<DbPool> {
    #![allow(clippy::borrowed_box)]
    // First connect synchronously to apply migrations.
    let mut connection = PgConnection::establish(db_url)?;
    let migrations =
        connection
            .pending_migrations(MIGRATIONS)
            .map_err(|e| Error::DbMigrationError {
                message: e.to_string(),
            })?;
    for migration in migrations.iter() {
        info!(migration = %migration.name(), "Running migration");
        connection
            .run_migration(migration)
            .map_err(|e| Error::DbMigrationError {
                message: e.to_string(),
            })?;
    }

    let last_migration = if migrations.is_empty() {
        MIGRATIONS
            .migrations()
            .map_err(|e| Error::DbMigrationError {
                message: e.to_string(),
            })?
            .last()
            .map(|m: &Box<dyn Migration<Pg>>| m.name().to_string())
    } else {
        migrations.last().map(|m| m.name().to_string())
    };

    trace!(migration = last_migration, "Database is fully migrated");

    // Now set up the async pool.
    let config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(db_url);
    let pool = Pool::builder(config).build()?;

    // Verify that we can connect.
    let mut connection = pool.get().await?;
    connection
        .batch_execute("REFRESH MATERIALIZED VIEW \"user_catalog\";")
        .await?;

    Ok(pool)
}

pub(crate) mod sealed {
    use super::DbConnection;
    use crate::Result;
    use async_trait::async_trait;
    use diesel_async::scoped_futures::ScopedBoxFuture;
    use pixelbin_shared::Config;

    #[async_trait]
    pub trait ConnectionProvider {
        async fn with_connection<'a, R, F>(&mut self, cb: F) -> Result<R>
        where
            R: 'a,
            F: for<'b> FnOnce(&'b mut DbConnection) -> ScopedBoxFuture<'a, 'b, Result<R>>
                + Send
                + 'a;

        fn config(&self) -> Config;
    }
}

#[derive(Clone, Debug)]
pub struct StoreStats {
    pub users: u32,
    pub catalogs: u32,
    pub albums: u32,
    pub tags: u32,
    pub people: u32,
    pub media: u32,
    pub files: u32,
    pub alternate_files: u32,
}

#[async_trait]
pub trait DbQueries: sealed::ConnectionProvider + Sized {
    async fn verify_credentials(&mut self, email: &str, password: &str) -> Result<models::User> {
        self.with_connection(|conn| {
            async move {
                let mut user: models::User = user::table
                    .filter(user::email.eq(email))
                    .select(user::all_columns)
                    .get_result::<models::User>(conn)
                    .await
                    .optional()?
                    .ok_or_else(|| Error::NotFound)?;

                if let Some(ref password_hash) = user.password {
                    match bcrypt::verify(password, password_hash) {
                        Ok(true) => (),
                        _ => return Err(Error::NotFound),
                    }
                } else {
                    return Err(Error::NotFound);
                }

                user.last_login = Some(OffsetDateTime::now_utc());

                diesel::update(user::table)
                    .filter(user::email.eq(email))
                    .set(user::last_login.eq(&user.last_login))
                    .execute(conn)
                    .await?;

                Ok(user)
            }
            .scope_boxed()
        })
        .await
    }

    async fn stats(&mut self) -> Result<StoreStats> {
        self.with_connection(|conn| {
            async move {
                let users: i64 = user::table.count().get_result(conn).await?;
                let catalogs: i64 = catalog::table.count().get_result(conn).await?;
                let albums: i64 = album::table.count().get_result(conn).await?;
                let tags: i64 = tag::table.count().get_result(conn).await?;
                let people: i64 = person::table.count().get_result(conn).await?;
                let media: i64 = media_item::table.count().get_result(conn).await?;
                let files: i64 = media_file::table.count().get_result(conn).await?;
                let alternate_files: i64 = alternate_file::table.count().get_result(conn).await?;

                Ok(StoreStats {
                    users: users as u32,
                    catalogs: catalogs as u32,
                    albums: albums as u32,
                    tags: tags as u32,
                    people: people as u32,
                    media: media as u32,
                    files: files as u32,
                    alternate_files: alternate_files as u32,
                })
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_all_media(
        &mut self,
        storage: &models::Storage,
    ) -> Result<Vec<(models::MediaItem, models::MediaFile, PathBuf, RemotePath)>> {
        let local_storage = self.config().local_storage.clone();

        self.with_connection(|conn| {
            async move {
                let files = media_item::table
                    .inner_join(
                        media_file::table.on(media_item::media_file.eq(media_file::id.nullable())),
                    )
                    .inner_join(catalog::table.on(media_item::catalog.eq(catalog::id)))
                    .filter(catalog::storage.eq(&storage.id))
                    .select((
                        media_item::all_columns,
                        media_file::all_columns,
                        media_item::catalog,
                    ))
                    .load::<(models::MediaItem, models::MediaFile, String)>(conn)
                    .await?;

                Ok(files
                    .into_iter()
                    .map(|(media_item, media_file, catalog)| {
                        let media_path =
                            MediaFilePath::new(&catalog, &media_file.media, &media_file.id);
                        let file_path = local_storage.join(media_path.local_path());
                        let remote_path = media_path.remote_path().join(&media_file.file_name);
                        (media_item, media_file, file_path, remote_path)
                    })
                    .collect())
            }
            .scope_boxed()
        })
        .await
    }

    async fn upsert_media_files(&mut self, media_files: &[models::MediaFile]) -> Result {
        self.with_connection(|conn| {
            async move { models::MediaFile::upsert(conn, media_files).await }.scope_boxed()
        })
        .await
    }

    async fn upsert_media_items(&mut self, media_files: &[models::MediaItem]) -> Result {
        self.with_connection(|conn| {
            async move { models::MediaItem::upsert(conn, media_files).await }.scope_boxed()
        })
        .await
    }

    async fn get_user(&mut self, email: &str) -> Result<models::User> {
        self.with_connection(|conn| {
            async move {
                user::table
                    .filter(user::email.eq(email))
                    .select(user::all_columns)
                    .get_result::<models::User>(conn)
                    .await
                    .optional()?
                    .ok_or_else(|| Error::NotFound)
            }
            .scope_boxed()
        })
        .await
    }

    async fn get_catalog_storage(&mut self, catalog: &str) -> Result<models::Storage> {
        self.with_connection(|conn| {
            async move {
                storage::table
                    .inner_join(catalog::table.on(catalog::storage.eq(storage::id)))
                    .filter(catalog::id.eq(catalog))
                    .select(storage::all_columns)
                    .get_result::<models::Storage>(conn)
                    .await
                    .optional()?
                    .ok_or_else(|| Error::NotFound)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_storage(&mut self) -> Result<Vec<models::Storage>> {
        self.with_connection(|conn| {
            async move {
                Ok(storage::table
                    .select(storage::all_columns)
                    .load::<models::Storage>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_catalogs(&mut self) -> Result<Vec<models::Catalog>> {
        self.with_connection(|conn| {
            async move {
                Ok(catalog::table
                    .select(catalog::all_columns)
                    .load::<models::Catalog>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_storage(&mut self, email: &str) -> Result<Vec<models::Storage>> {
        self.with_connection(|conn| {
            async move {
                Ok(storage::table
                    .filter(storage::owner.eq(email))
                    .select(storage::all_columns)
                    .load::<models::Storage>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_catalogs(&mut self, email: &str) -> Result<Vec<models::Catalog>> {
        self.with_connection(|conn| {
            async move {
                Ok(catalog::table
                    .inner_join(user_catalog::table.on(user_catalog::catalog.eq(catalog::id)))
                    .filter(user_catalog::user.eq(email))
                    .select(catalog::all_columns)
                    .order(catalog::name.asc())
                    .load::<models::Catalog>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_people(&mut self, email: &str) -> Result<Vec<models::Person>> {
        self.with_connection(|conn| {
            async move {
                Ok(user_catalog::table
                    .inner_join(person::table.on(person::catalog.eq(user_catalog::catalog)))
                    .filter(user_catalog::user.eq(email))
                    .select(person::all_columns)
                    .order(person::name.asc())
                    .load::<models::Person>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_tags(&mut self, email: &str) -> Result<Vec<models::Tag>> {
        self.with_connection(|conn| {
            async move {
                Ok(user_catalog::table
                    .inner_join(tag::table.on(tag::catalog.eq(user_catalog::catalog)))
                    .filter(user_catalog::user.eq(email))
                    .select(tag::all_columns)
                    .order(tag::name.asc())
                    .load::<models::Tag>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_albums(&mut self, email: &str) -> Result<Vec<models::Album>> {
        self.with_connection(|conn| {
            async move {
                Ok(user_catalog::table
                    .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
                    .filter(user_catalog::user.eq(email))
                    .select(album::all_columns)
                    .order(album::name.asc())
                    .load::<models::Album>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_albums_with_count(
        &mut self,
        email: &str,
    ) -> Result<Vec<(models::Album, i64)>> {
        self.with_connection(|conn| {
            async move {
                Ok(user_catalog::table
                    .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
                    .left_join(media_album::table.on(media_album::album.eq(album::id)))
                    .filter(user_catalog::user.eq(email))
                    .group_by(album::id)
                    .select((album::all_columns, count(media_album::media.nullable())))
                    .order(album::name.asc())
                    .load::<(models::Album, i64)>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn get_user_album(&mut self, email: &str, album: &str) -> Result<models::Album> {
        self.with_connection(|conn| {
            async move {
                user_catalog::table
                    .inner_join(album::table.on(album::catalog.eq(user_catalog::catalog)))
                    .filter(user_catalog::user.eq(email))
                    .filter(album::id.eq(album))
                    .select(album::all_columns)
                    .get_result::<models::Album>(conn)
                    .await
                    .optional()?
                    .ok_or_else(|| Error::NotFound)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_album_media(
        &mut self,
        album: &models::Album,
        _recursive: bool,
    ) -> Result<Vec<models::MediaView>> {
        self.with_connection(|conn| album.list_media(conn).scope_boxed())
            .await
    }

    async fn get_user_search(&mut self, email: &str, search: &str) -> Result<models::SavedSearch> {
        self.with_connection(|conn| {
            async move {
                user_catalog::table
                    .inner_join(
                        saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)),
                    )
                    .filter(user_catalog::user.eq(email))
                    .filter(saved_search::id.eq(search))
                    .select(saved_search::all_columns)
                    .get_result::<models::SavedSearch>(conn)
                    .await
                    .optional()?
                    .ok_or_else(|| Error::NotFound)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_search_media(
        &mut self,
        search: &models::SavedSearch,
    ) -> Result<Vec<models::MediaView>> {
        self.with_connection(|conn| search.list_media(conn).scope_boxed())
            .await
    }

    async fn get_user_catalog(&mut self, email: &str, catalog: &str) -> Result<models::Catalog> {
        self.with_connection(|conn| {
            async move {
                user_catalog::table
                    .inner_join(catalog::table.on(catalog::id.eq(user_catalog::catalog)))
                    .filter(user_catalog::user.eq(email))
                    .filter(catalog::id.eq(catalog))
                    .select(catalog::all_columns)
                    .get_result::<models::Catalog>(conn)
                    .await
                    .optional()?
                    .ok_or_else(|| Error::NotFound)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_catalog_media(
        &mut self,
        catalog: &models::Catalog,
    ) -> Result<Vec<models::MediaView>> {
        self.with_connection(|conn| catalog.list_media(conn).scope_boxed())
            .await
    }

    async fn list_media_alternates(
        &mut self,
        email: Option<&str>,
        item: &str,
        file: &str,
        mimetype: &str,
        alternate_type: models::AlternateFileType,
    ) -> Result<Vec<(models::AlternateFile, MediaFilePath, PathBuf)>> {
        let config = self.config();

        self.with_connection(|conn| {
            async move {
                if let Some(email) = email {
                    let files =
                        user_catalog::table
                            .filter(user_catalog::user.eq(email))
                            .inner_join(
                                media_item::table.on(media_item::catalog.eq(user_catalog::catalog)),
                            )
                            .filter(media_item::id.eq(item))
                            .filter(media_item::media_file.eq(file))
                            .inner_join(alternate_file::table.on(
                                media_item::media_file.eq(alternate_file::media_file.nullable()),
                            ))
                            .filter(alternate_file::mimetype.eq(mimetype))
                            .filter(alternate_file::type_.eq(alternate_type))
                            .select((
                                alternate_file::all_columns,
                                media_item::id,
                                media_item::catalog,
                            ))
                            .load::<(models::AlternateFile, String, String)>(conn)
                            .await?;

                    if !files.is_empty() {
                        return Ok(files
                            .into_iter()
                            .map(|(alternate, media_item, catalog)| {
                                let file_path = MediaFilePath::new(
                                    &catalog,
                                    &media_item,
                                    &alternate.media_file,
                                );
                                let local_path = config
                                    .local_storage
                                    .join(file_path.local_path())
                                    .join(joinable(&alternate.file_name));
                                (alternate, file_path, local_path)
                            })
                            .collect::<Vec<(models::AlternateFile, MediaFilePath, PathBuf)>>());
                    }
                }

                Ok(vec![])
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_searches(&mut self, email: &str) -> Result<Vec<models::SavedSearch>> {
        self.with_connection(|conn| {
            async move {
                Ok(user_catalog::table
                    .inner_join(
                        saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)),
                    )
                    .filter(user_catalog::user.eq(email))
                    .select(saved_search::all_columns)
                    .order(saved_search::name.asc())
                    .load::<models::SavedSearch>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_searches_with_count(
        &mut self,
        email: &str,
    ) -> Result<Vec<(models::SavedSearch, i64)>> {
        self.with_connection(|conn| {
            async move {
                Ok(user_catalog::table
                    .inner_join(
                        saved_search::table.on(saved_search::catalog.eq(user_catalog::catalog)),
                    )
                    .left_join(media_search::table.on(media_search::search.eq(saved_search::id)))
                    .filter(user_catalog::user.eq(email))
                    .group_by(saved_search::id)
                    .select((
                        saved_search::all_columns,
                        count(media_search::media.nullable()),
                    ))
                    .order(saved_search::name.asc())
                    .load::<(models::SavedSearch, i64)>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }
}

impl<T> DbQueries for T where T: sealed::ConnectionProvider {}
