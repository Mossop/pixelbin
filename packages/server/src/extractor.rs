use actix_session::Session as ActixSession;
use actix_web::{dev::Payload, web, FromRequest, HttpRequest};
use futures::future::LocalBoxFuture;

use crate::{util::long_id, AppState, Session};

impl FromRequest for Session {
    type Error = actix_web::Error;
    type Future = LocalBoxFuture<'static, Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let req = req.clone();

        Box::pin(async move {
            let data = web::Data::<AppState<'_>>::extract(&req).await?;
            let cookie_session = ActixSession::extract(&req).await?;

            let session_id = match cookie_session.get::<String>("id")? {
                Some(id) => id,
                None => {
                    let mut id = long_id("C");
                    while data.sessions.contains_key(&id).await {
                        id = long_id("C");
                    }
                    cookie_session.insert("id", &id)?;
                    id
                }
            };

            Ok(data.sessions.get(session_id).await)
        })
    }
}
