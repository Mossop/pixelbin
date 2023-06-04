#![deny(unreachable_pub)]
use std::fmt;

use actix_session::{
    config::{CookieContentSecurity, PersistentSession, TtlExtensionPolicy},
    storage::CookieSessionStore,
    Session, SessionMiddleware,
};
use actix_web::{
    cookie::{time::Duration, Key},
    get, web, App, HttpResponse, HttpServer, Responder, ResponseError,
};
use mime_guess::from_path;
use pixelbin_shared::{Error, Result};
use pixelbin_store::Store;
use rust_embed::RustEmbed;
use templates::Templates;

mod middleware;
mod templates;

#[derive(RustEmbed)]
#[folder = "../../target/web/static/"]
struct StaticAssets;

#[derive(Debug)]
struct InternalError {
    inner: Error,
}

impl fmt::Display for InternalError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.inner.fmt(f)
    }
}

impl From<Error> for InternalError {
    fn from(value: Error) -> Self {
        Self { inner: value }
    }
}

impl ResponseError for InternalError {}

struct AppState<'a> {
    store: Store,
    templates: Templates<'a>,
}

type HttpResult<T> = std::result::Result<T, InternalError>;

#[get("/")]
async fn index(state: web::Data<AppState<'_>>, session: Session) -> HttpResult<impl Responder> {
    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(state.templates.index()?))
}

#[get("/static/{_:.*}")]
async fn static_files(path: web::Path<String>) -> impl Responder {
    let local_path = path.as_str();

    match StaticAssets::get(local_path) {
        Some(content) => HttpResponse::Ok()
            .content_type(from_path(local_path).first_or_octet_stream().as_ref())
            .body(content.data.into_owned()),
        None => HttpResponse::NotFound().body("404 Not Found"),
    }
}

pub async fn serve(store: Store) -> Result {
    let port = store.config().port.unwrap_or(80);

    let state = AppState {
        store,
        templates: Templates::new(),
    };

    let app_data = web::Data::new(state);

    HttpServer::new(move || {
        App::new()
            .app_data(app_data.clone())
            .wrap(middleware::Logging)
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), Key::from(&[0; 64]))
                    .cookie_name("pxlbin".to_string())
                    .cookie_content_security(CookieContentSecurity::Private)
                    .session_lifecycle(
                        PersistentSession::default()
                            .session_ttl(Duration::days(30))
                            .session_ttl_extension_policy(TtlExtensionPolicy::OnEveryRequest),
                    )
                    .build(),
            )
            .service(index)
            .service(static_files)
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await?;

    Ok(())
}
