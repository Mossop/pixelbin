use actix_web::{get, web, HttpResponse, Responder};
use mime_guess::from_path;
use rust_embed::RustEmbed;

use crate::util::HttpResult;
use crate::AppState;

#[derive(RustEmbed)]
#[folder = "../../target/web/static/"]
struct StaticAssets;

#[get("/")]
async fn index(state: web::Data<AppState<'_>>) -> HttpResult<impl Responder> {
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
