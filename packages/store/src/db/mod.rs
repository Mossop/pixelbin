mod functions;

use std::path::PathBuf;

use async_trait::async_trait;
use diesel::prelude::*;
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    scoped_futures::ScopedFutureExt,
    AsyncPgConnection, RunQueryDsl, SimpleAsyncConnection,
};
use time::OffsetDateTime;
use tracing::instrument;

use crate::{joinable, manual_schema::*, models, schema::*, MediaFilePath, Result};
use functions::*;
use pixelbin_shared::Error;

pub(crate) type DbConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<DbConnection>;

macro_rules! media_view_query {
    () => {
        media_item::table
            .left_outer_join(
                media_file::table.on(media_item::media_file.eq(media_file::id.nullable())),
            )
            .select((
                media_item::id,
                media_item::catalog,
                media_item::created,
                greatest(media_item::updated, media_file::uploaded.nullable()),
                coalesce(media_item::filename, media_file::filename.nullable()),
                coalesce(media_item::title, media_file::title.nullable()),
                coalesce(media_item::description, media_file::description.nullable()),
                coalesce(media_item::label, media_file::label.nullable()),
                coalesce(media_item::category, media_file::category.nullable()),
                coalesce(media_item::taken, media_file::taken.nullable()),
                select_zone(
                    media_item::taken,
                    media_item::taken_zone,
                    media_file::taken_zone.nullable(),
                ),
                coalesce(media_item::longitude, media_file::longitude.nullable()),
                coalesce(media_item::latitude, media_file::latitude.nullable()),
                coalesce(media_item::altitude, media_file::altitude.nullable()),
                coalesce(media_item::location, media_file::location.nullable()),
                coalesce(media_item::city, media_file::city.nullable()),
                coalesce(media_item::state, media_file::state.nullable()),
                coalesce(media_item::country, media_file::country.nullable()),
                coalesce(media_item::orientation, media_file::orientation.nullable()),
                coalesce(media_item::make, media_file::make.nullable()),
                coalesce(media_item::model, media_file::model.nullable()),
                coalesce(media_item::lens, media_file::lens.nullable()),
                coalesce(
                    media_item::photographer,
                    media_file::photographer.nullable(),
                ),
                coalesce(media_item::aperture, media_file::aperture.nullable()),
                coalesce(
                    media_item::shutter_speed,
                    media_file::shutter_speed.nullable(),
                ),
                coalesce(media_item::iso, media_file::iso.nullable()),
                coalesce(
                    media_item::focal_length,
                    media_file::focal_length.nullable(),
                ),
                coalesce(media_item::rating, media_file::rating.nullable()),
                (
                    media_file::id,
                    media_file::file_size,
                    media_file::mimetype,
                    media_file::width,
                    media_file::height,
                    media_file::duration,
                    media_file::frame_rate,
                    media_file::bit_rate,
                    media_file::uploaded,
                    media_file::file_name,
                )
                    .nullable(),
            ))
            .distinct()
    };
}

#[instrument(err)]
pub(crate) async fn connect(db_url: &str) -> Result<DbPool> {
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

    async fn user(&mut self, email: &str) -> Result<models::User> {
        self.with_connection(|conn| {
            async move {
                Ok(user::table
                    .filter(user::email.eq(email))
                    .select(user::all_columns)
                    .get_result::<models::User>(conn)
                    .await?)
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

    async fn user_album(&mut self, email: &str, album: &str) -> Result<models::Album> {
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

    async fn user_album_media(
        &mut self,
        email: &str,
        album: &str,
        _recursive: bool,
    ) -> Result<Vec<models::MediaView>> {
        self.with_connection(|conn| {
            async move {
                Ok(media_view_query!()
                    .inner_join(
                        user_catalog::table.on(media_item::catalog.eq(user_catalog::catalog)),
                    )
                    .inner_join(media_album::table.on(media_item::id.eq(media_album::media)))
                    .filter(media_album::album.eq(album))
                    .filter(user_catalog::user.eq(email))
                    .load::<models::MediaView>(conn)
                    .await?)
            }
            .scope_boxed()
        })
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
}

impl<T> DbQueries for T where T: sealed::ConnectionProvider {}
