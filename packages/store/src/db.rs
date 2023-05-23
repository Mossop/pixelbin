use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};

use crate::Result;

pub(crate) type DbConnection = AsyncPgConnection;
pub(crate) type DbPool = Pool<DbConnection>;

pub(crate) async fn connect(db_url: &str) -> Result<DbPool> {
    let config = AsyncDieselConnectionManager::<AsyncPgConnection>::new(db_url);
    let pool = Pool::builder(config).build()?;

    // Verify that we can connect.
    let _connection = pool.get().await?;

    Ok(pool)
}
