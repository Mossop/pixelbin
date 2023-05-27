use actix_web::{
    get,
    web::{self},
    App, HttpResponse, HttpServer, Responder,
};
use pixelbin_shared::Result;
use pixelbin_store::Store;

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

pub async fn serve(store: Store) -> Result {
    let port = store.config().port.unwrap_or(80);
    let data = web::Data::new(store);

    HttpServer::new(move || App::new().app_data(data.clone()).service(hello))
        .bind(("0.0.0.0", port))?
        .run()
        .await?;

    Ok(())
}
