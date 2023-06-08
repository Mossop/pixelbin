#![deny(unreachable_pub)]
use std::time::Duration;

use actix_session::{
    config::{CookieContentSecurity, PersistentSession, TtlExtensionPolicy},
    storage::CookieSessionStore,
    SessionMiddleware,
};
use actix_web::{
    cookie::{time::Duration as CookieDuration, Key},
    web, App, HttpServer,
};
use cache::Cache;
use pixelbin_shared::Result;
use pixelbin_store::Store;
use templates::Templates;

mod cache;
mod extractor;
mod handler;
mod middleware;
mod templates;
mod util;

pub(crate) use handler::ApiState;

const SESSION_LENGTH: u64 = 60 * 60 * 24 * 7;

#[derive(Clone)]
struct Session {
    id: String,
    email: Option<String>,
}

struct AppState<'a> {
    store: Store,
    sessions: Cache<String, Session>,
    templates: Templates<'a>,
}

pub async fn serve(store: Store) -> Result {
    let port = store.config().port.unwrap_or(80);

    let state = AppState {
        store,
        sessions: Cache::new(Duration::from_secs(SESSION_LENGTH)),
        templates: Templates::new(),
    };

    let app_data = web::Data::new(state);

    HttpServer::new(move || {
        App::new()
            .app_data(app_data.clone())
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), Key::from(&[0; 64]))
                    .cookie_name("pxlbin".to_string())
                    .cookie_content_security(CookieContentSecurity::Private)
                    .session_lifecycle(
                        PersistentSession::default()
                            .session_ttl(CookieDuration::seconds(SESSION_LENGTH as i64))
                            .session_ttl_extension_policy(TtlExtensionPolicy::OnEveryRequest),
                    )
                    .build(),
            )
            .wrap(middleware::Logging)
            .service(handler::index)
            .service(handler::static_files)
            .service(handler::api_login)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;

    Ok(())
}
