use async_trait::async_trait;
use diesel::prelude::*;
use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    scoped_futures::ScopedFutureExt,
    AsyncPgConnection, RunQueryDsl,
};
use time::OffsetDateTime;

use crate::{manual_schema::*, models, schema::*, Result};

pub(crate) type DbConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<DbConnection>;

pub(crate) async fn connect(db_url: &str) -> Result<DbPool> {
    let config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(db_url);
    let pool = Pool::builder(config).build()?;

    // Verify that we can connect.
    let _connection = pool.get().await?;

    Ok(pool)
}

pub(crate) mod sealed {
    use super::DbConnection;
    use crate::Result;
    use async_trait::async_trait;
    use diesel_async::scoped_futures::ScopedBoxFuture;

    #[async_trait]
    pub trait ConnectionProvider {
        async fn with_connection<'a, R, F>(&mut self, cb: F) -> Result<R>
        where
            R: 'a,
            F: for<'b> FnOnce(&'b mut DbConnection) -> ScopedBoxFuture<'a, 'b, Result<R>>
                + Send
                + 'a;
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
    async fn verify_credentials(
        &mut self,
        email: &str,
        password: &str,
    ) -> Result<Option<models::User>> {
        self.with_connection(|conn| {
            async move {
                let mut user = match user::table
                    .filter(user::email.eq(email))
                    .select(user::all_columns)
                    .get_result::<models::User>(conn)
                    .await
                    .optional()?
                {
                    Some(u) => u,
                    None => return Ok(None),
                };

                // if let Some(ref password_hash) = user.password {
                //     match bcrypt::verify(password, password_hash) {
                //         Ok(true) => (),
                //         _ => return Ok(None),
                //     }
                // } else {
                //     return Ok(None);
                // }

                user.last_login = Some(OffsetDateTime::now_utc());

                diesel::update(user::table)
                    .filter(user::email.eq(email))
                    .set(user::last_login.eq(&user.last_login))
                    .execute(conn)
                    .await?;

                Ok(Some(user))
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

    async fn list_user_storage(&mut self, user: &str) -> Result<Vec<models::Storage>> {
        self.with_connection(|conn| {
            async move {
                Ok(storage::table
                    .filter(storage::owner.eq(user))
                    .select(storage::all_columns)
                    .load::<models::Storage>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_user_catalogs(&mut self, user: &str) -> Result<Vec<models::Catalog>> {
        self.with_connection(|conn| {
            async move {
                Ok(catalog::table
                    .inner_join(user_catalog::table.on(user_catalog::catalog.eq(catalog::id)))
                    .filter(user_catalog::user.eq(user))
                    .select(catalog::all_columns)
                    .load::<models::Catalog>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_catalog_people(&mut self, catalogs: &Vec<&str>) -> Result<Vec<models::Person>> {
        self.with_connection(|conn| {
            async move {
                Ok(person::table
                    .filter(person::catalog.eq_any(catalogs))
                    .select(person::all_columns)
                    .load::<models::Person>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_catalog_tags(&mut self, catalogs: &Vec<&str>) -> Result<Vec<models::Tag>> {
        self.with_connection(|conn| {
            async move {
                Ok(tag::table
                    .filter(tag::catalog.eq_any(catalogs))
                    .select(tag::all_columns)
                    .load::<models::Tag>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_catalog_albums(&mut self, catalogs: &Vec<&str>) -> Result<Vec<models::Album>> {
        self.with_connection(|conn| {
            async move {
                Ok(album::table
                    .filter(album::catalog.eq_any(catalogs))
                    .select(album::all_columns)
                    .load::<models::Album>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }

    async fn list_catalog_searches(
        &mut self,
        catalogs: &Vec<&str>,
    ) -> Result<Vec<models::SavedSearch>> {
        self.with_connection(|conn| {
            async move {
                Ok(saved_search::table
                    .filter(saved_search::catalog.eq_any(catalogs))
                    .select(saved_search::all_columns)
                    .load::<models::SavedSearch>(conn)
                    .await?)
            }
            .scope_boxed()
        })
        .await
    }
}

impl<T> DbQueries for T where T: sealed::ConnectionProvider {}
