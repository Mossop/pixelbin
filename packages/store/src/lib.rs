#![deny(unreachable_pub)]
//! A basic abstraction around the pixelbin data stores.
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

mod db;
mod error;
mod schema;

use db::{connect, DbPool};
pub use error::{Error, Result};
use schema::*;

#[derive(Clone)]
pub struct Store {
    pool: DbPool,
}

#[derive(Clone, Debug)]
pub struct StoreStats {
    pub users: u32,
    pub catalogs: u32,
    pub albums: u32,
    pub tags: u32,
    pub people: u32,
    pub media: u32,
}

impl Store {
    pub async fn new(database_url: &str) -> Result<Self> {
        Ok(Store {
            pool: connect(database_url).await?,
        })
    }

    pub async fn stats(&self) -> Result<StoreStats> {
        let mut conn = self.pool.get().await?;

        let users = user::table.count().get_result::<i64>(&mut conn).await?;
        let catalogs = catalog::table.count().get_result::<i64>(&mut conn).await?;
        let albums = album::table.count().get_result::<i64>(&mut conn).await?;
        let tags = tag::table.count().get_result::<i64>(&mut conn).await?;
        let people = person::table.count().get_result::<i64>(&mut conn).await?;
        let media = media_info::table
            .count()
            .get_result::<i64>(&mut conn)
            .await?;

        Ok(StoreStats {
            users: users as u32,
            catalogs: catalogs as u32,
            albums: albums as u32,
            tags: tags as u32,
            people: people as u32,
            media: media as u32,
        })
    }
}
