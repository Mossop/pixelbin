use actix_web::{body::BoxBody, http::StatusCode, post, web, HttpResponse, Responder};
use pixelbin_shared::Error;
use pixelbin_store::{models, DbQueries};
use scoped_futures::ScopedFutureExt;
use serde::{Deserialize, Serialize};
use tracing::instrument;

use crate::{util::HttpResult, AppState, Result, Session};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserState {
    #[serde(flatten)]
    user: models::User,
    storage: Vec<models::Storage>,
    catalogs: Vec<models::Catalog>,
    people: Vec<models::Person>,
    tags: Vec<models::Tag>,
    albums: Vec<models::Album>,
    searches: Vec<models::SavedSearch>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApiState {
    user: Option<UserState>,
}

#[instrument(skip_all, err)]
async fn build_state<Q: DbQueries + Send>(db: &mut Q, session: &Session) -> Result<ApiState> {
    if let Some(ref email) = session.email {
        match db.user(email).await {
            Ok(user) => {
                return Ok(ApiState {
                    user: Some(UserState {
                        user,
                        storage: db.list_user_storage(email).await?,
                        catalogs: db.list_user_catalogs(email).await?,
                        people: db.list_user_people(email).await?,
                        tags: db.list_user_tags(email).await?,
                        albums: db.list_user_albums(email).await?,
                        searches: db.list_user_searches(email).await?,
                    }),
                })
            }
            Err(Error::NotFound) => {}
            Err(e) => return Err(e),
        }
    }

    Ok(ApiState::default())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum ApiErrorCode {
    // UnknownException,
    // BadMethod,
    NotLoggedIn,
    // LoginFailed,
    // InvalidData,
    // NotFound,
    // TemporaryFailure,
    // InvalidHost,
}

impl ApiErrorCode {
    fn into<T>(self) -> ApiResult<T> {
        ApiResult::Err(ApiError { code: self })
    }
}

#[derive(Serialize)]
struct ApiError {
    code: ApiErrorCode,
}

impl From<ApiError> for HttpResponse {
    fn from(api_error: ApiError) -> HttpResponse {
        let code = match api_error.code {
            // ApiErrorCode::UnknownException => 500,
            // ApiErrorCode::BadMethod => 405,
            ApiErrorCode::NotLoggedIn => 401,
            // ApiErrorCode::LoginFailed => 401,
            // ApiErrorCode::InvalidData => 400,
            // ApiErrorCode::NotFound => 404,
            // ApiErrorCode::TemporaryFailure => 503,
            // ApiErrorCode::InvalidHost => 403,
        };

        HttpResponse::build(StatusCode::from_u16(code).unwrap())
            .content_type("application/json")
            .body(serde_json::to_string_pretty(&api_error).unwrap())
    }
}

enum ApiResult<T> {
    Ok(T),
    Err(ApiError),
}

impl<T> From<T> for ApiResult<T> {
    fn from(result: T) -> Self {
        Self::Ok(result)
    }
}

impl<T: Serialize> Responder for ApiResult<T> {
    type Body = BoxBody;

    fn respond_to(self, _req: &actix_web::HttpRequest) -> HttpResponse<Self::Body> {
        match self {
            ApiResult::Ok(inner) => HttpResponse::Ok()
                .content_type("application/json")
                .body(serde_json::to_string_pretty(&inner).unwrap()),
            ApiResult::Err(err) => err.into(),
        }
    }
}

#[derive(Deserialize)]
struct Credentials {
    email: String,
    password: String,
}

#[post("/api/login")]
#[instrument(skip(app_state, session, credentials))]
async fn login(
    app_state: web::Data<AppState>,
    session: Session,
    credentials: web::Json<Credentials>,
) -> HttpResult<ApiResult<ApiState>> {
    Ok(app_state
        .store
        .clone()
        .in_transaction(|mut trx| {
            async move {
                match trx
                    .verify_credentials(&credentials.email, &credentials.password)
                    .await
                {
                    Ok(user) => {
                        let session = app_state
                            .sessions
                            .update(&session.id, |sess| {
                                sess.email = Some(user.email.clone());
                            })
                            .await;

                        Ok(build_state(&mut trx, &session).await?.into())
                    }
                    Err(Error::NotFound) => Ok(ApiErrorCode::NotLoggedIn.into()),
                    Err(e) => Err(e),
                }
            }
            .scope_boxed()
        })
        .await?)
}

#[post("/api/logout")]
#[instrument(skip(app_state, session))]
async fn logout(
    app_state: web::Data<AppState>,
    session: Session,
) -> HttpResult<ApiResult<ApiState>> {
    let session = app_state
        .sessions
        .update(&session.id, |sess| {
            sess.email = None;
        })
        .await;

    Ok(app_state
        .store
        .in_transaction(|mut trx| {
            async move { Ok(build_state(&mut trx, &session).await?.into()) }.scope_boxed()
        })
        .await?)
}

// #[serde_as]
// #[derive(Debug, Deserialize)]
// struct MediaListQuery {
//     #[serde_as(as = "StringWithSeparator::<CommaSeparator, String>")]
//     id: Vec<String>,
// }

// #[get("/api/media/get")]
// #[instrument]
// async fn api_media_get(media_list: web::Query<MediaListQuery>) -> HttpResult<HttpResponse> {
//     todo!();
// }
