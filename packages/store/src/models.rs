use diesel::{backend, deserialize, serialize, sql_types, AsExpression, Queryable};
use serde::Serialize;
use serde_repr::Serialize_repr;
use time::{OffsetDateTime, PrimitiveDateTime};

use crate::{aws::AwsClient, search::Query, RemotePath};
use pixelbin_shared::Result;

pub(crate) mod serialize_datetime {
    use serde::{Serialize, Serializer};
    use time::{
        format_description::well_known::{iso8601::Config, Iso8601},
        OffsetDateTime,
    };

    const DATETIME_FORMAT: u128 = Config::DEFAULT.encode();

    pub(crate) fn serialize<S>(dt: &OffsetDateTime, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        dt.format(&Iso8601::<DATETIME_FORMAT>)
            .unwrap()
            .serialize(serializer)
    }

    pub(crate) mod option {
        use super::*;

        pub(crate) fn serialize<S>(
            dt: &Option<OffsetDateTime>,
            serializer: S,
        ) -> Result<S::Ok, S::Error>
        where
            S: Serializer,
        {
            dt.map(|dt| dt.format(&Iso8601::<DATETIME_FORMAT>).unwrap())
                .serialize(serializer)
        }
    }
}

pub(crate) mod serialize_primitive_datetime {
    use serde::{Serialize, Serializer};
    use time::{
        format_description::well_known::{
            iso8601::{Config, FormattedComponents},
            Iso8601,
        },
        PrimitiveDateTime,
    };

    const DATETIME_FORMAT: u128 = Config::DEFAULT
        .set_formatted_components(FormattedComponents::DateTime)
        .encode();

    pub(crate) fn serialize<S>(dt: &PrimitiveDateTime, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        dt.format(&Iso8601::<DATETIME_FORMAT>)
            .unwrap()
            .serialize(serializer)
    }

    pub(crate) mod option {
        use super::*;

        pub(crate) fn serialize<S>(
            dt: &Option<PrimitiveDateTime>,
            serializer: S,
        ) -> Result<S::Ok, S::Error>
        where
            S: Serializer,
        {
            dt.map(|dt| dt.format(&Iso8601::<DATETIME_FORMAT>).unwrap())
                .serialize(serializer)
        }
    }
}

#[derive(Debug, Clone, Copy, AsExpression, deserialize::FromSqlRow)]
#[diesel(sql_type = sql_types::VarChar)]
pub enum AlternateFileType {
    Thumbnail,
    Reencode,
}

impl<DB> deserialize::FromSql<sql_types::VarChar, DB> for AlternateFileType
where
    DB: backend::Backend,
    String: deserialize::FromSql<sql_types::VarChar, DB>,
{
    fn from_sql(bytes: backend::RawValue<DB>) -> deserialize::Result<Self> {
        match String::from_sql(bytes)?.as_str() {
            "thumbnail" => Ok(AlternateFileType::Thumbnail),
            "reencode" => Ok(AlternateFileType::Reencode),
            x => Err(format!("Unrecognized variant {}", x).into()),
        }
    }
}

impl serialize::ToSql<sql_types::VarChar, diesel::pg::Pg> for AlternateFileType
where
    String: serialize::ToSql<sql_types::VarChar, diesel::pg::Pg>,
{
    fn to_sql<'b>(
        &'b self,
        out: &mut serialize::Output<'b, '_, diesel::pg::Pg>,
    ) -> serialize::Result {
        let string = match self {
            AlternateFileType::Thumbnail => "thumbnail".to_string(),
            AlternateFileType::Reencode => "reencode".to_string(),
        };

        <String as serialize::ToSql<sql_types::VarChar, diesel::pg::Pg>>::to_sql(
            &string,
            &mut out.reborrow(),
        )
    }
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, Serialize_repr, AsExpression, deserialize::FromSqlRow)]
#[diesel(sql_type = sql_types::Int4)]
pub enum Orientation {
    TopLeft = 1,
    TopRight = 2,
    BottomRight = 3,
    BottomLeft = 4,
    LeftTop = 5,
    RightTop = 6,
    RightBottom = 7,
    LeftBottom = 8,
}

impl<DB> deserialize::FromSql<sql_types::Int4, DB> for Orientation
where
    DB: backend::Backend,
    i32: deserialize::FromSql<sql_types::Int4, DB>,
{
    fn from_sql(bytes: backend::RawValue<DB>) -> deserialize::Result<Self> {
        match i32::from_sql(bytes)? {
            1 => Ok(Orientation::TopLeft),
            2 => Ok(Orientation::TopRight),
            3 => Ok(Orientation::BottomRight),
            4 => Ok(Orientation::BottomLeft),
            5 => Ok(Orientation::LeftTop),
            6 => Ok(Orientation::RightTop),
            7 => Ok(Orientation::RightBottom),
            8 => Ok(Orientation::LeftBottom),
            x => Err(format!("Unrecognized variant {}", x).into()),
        }
    }
}

impl<DB> serialize::ToSql<sql_types::Int4, DB> for Orientation
where
    DB: backend::Backend,
    i32: serialize::ToSql<sql_types::Int4, DB>,
{
    fn to_sql<'b>(&'b self, out: &mut serialize::Output<'b, '_, DB>) -> serialize::Result {
        match self {
            Orientation::TopLeft => 1.to_sql(out),
            Orientation::TopRight => 2.to_sql(out),
            Orientation::BottomRight => 3.to_sql(out),
            Orientation::BottomLeft => 4.to_sql(out),
            Orientation::LeftTop => 5.to_sql(out),
            Orientation::RightTop => 6.to_sql(out),
            Orientation::RightBottom => 7.to_sql(out),
            Orientation::LeftBottom => 8.to_sql(out),
        }
    }
}

#[derive(Queryable, Serialize, Clone, Debug)]
pub struct User {
    pub email: String,
    #[serde(skip)]
    pub(crate) password: Option<String>,
    pub fullname: Option<String>,
    pub administrator: bool,
    #[serde(with = "serialize_datetime")]
    pub created: OffsetDateTime,
    #[serde(with = "serialize_datetime::option")]
    pub last_login: Option<OffsetDateTime>,
    pub verified: Option<bool>,
}

#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Storage {
    pub id: String,
    pub name: String,
    #[serde(skip)]
    pub(crate) access_key_id: String,
    #[serde(skip)]
    pub(crate) secret_access_key: String,
    pub bucket: String,
    pub region: String,
    pub path: Option<String>,
    pub endpoint: Option<String>,
    pub public_url: Option<String>,
    #[serde(skip)]
    pub owner: String,
}

impl Storage {
    pub async fn list_remote_files(
        &self,
        prefix: Option<RemotePath>,
    ) -> Result<Vec<(RemotePath, u64)>> {
        let client = AwsClient::from_storage(self).await?;

        client.list_files(prefix).await
    }
}

#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Catalog {
    pub id: String,
    pub name: String,
    pub storage: String,
}

#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Person {
    pub id: String,
    pub name: String,
    pub catalog: String,
}

#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Tag {
    pub id: String,
    pub parent: Option<String>,
    pub name: String,
    pub catalog: String,
}

#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Album {
    pub id: String,
    pub parent: Option<String>,
    pub name: String,
    pub catalog: String,
}

#[derive(Queryable, Serialize, Clone, Debug)]
pub struct SavedSearch {
    pub id: String,
    pub name: String,
    pub shared: bool,
    pub query: Query,
    pub catalog: String,
}

#[derive(Queryable, Clone, Debug)]
pub struct MediaFile {
    pub id: String,
    pub uploaded: OffsetDateTime,
    pub process_version: i32,
    pub file_name: String,
    pub file_size: i32,
    pub mimetype: String,
    pub width: i32,
    pub height: i32,
    pub duration: Option<f32>,
    pub frame_rate: Option<f32>,
    pub bit_rate: Option<f32>,
    pub filename: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub label: Option<String>,
    pub category: Option<String>,
    pub location: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens: Option<String>,
    pub photographer: Option<String>,
    pub shutter_speed: Option<String>,
    pub taken_zone: Option<String>,
    pub orientation: Option<i32>,
    pub iso: Option<i32>,
    pub rating: Option<i32>,
    pub longitude: Option<f32>,
    pub latitude: Option<f32>,
    pub altitude: Option<f32>,
    pub aperture: Option<f32>,
    pub focal_length: Option<f32>,
    pub taken: Option<PrimitiveDateTime>,
    pub media: String,
}

#[derive(Queryable, Clone, Debug)]
pub struct AlternateFile {
    pub id: String,
    pub file_type: AlternateFileType,
    pub file_name: String,
    pub file_size: i32,
    pub mimetype: String,
    pub width: i32,
    pub height: i32,
    pub duration: Option<f32>,
    pub frame_rate: Option<f32>,
    pub bit_rate: Option<f32>,
    pub media_file: String,
    pub local: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MediaViewFile {
    pub id: String,
    pub file_size: u64,
    pub mimetype: String,
    pub width: u32,
    pub height: u32,
    pub duration: Option<f64>,
    pub frame_rate: Option<f64>,
    pub bit_rate: Option<f64>,
    #[serde(with = "serialize_datetime")]
    pub uploaded: OffsetDateTime,
    pub file_name: String,
}

#[derive(Queryable, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MediaView {
    pub id: String,
    pub catalog: String,
    #[serde(with = "serialize_datetime")]
    pub created: OffsetDateTime,
    #[serde(with = "serialize_datetime")]
    pub updated: OffsetDateTime,
    pub filename: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub label: Option<String>,
    pub category: Option<String>,
    #[serde(with = "serialize_primitive_datetime::option")]
    pub taken: Option<PrimitiveDateTime>,
    pub taken_zone: Option<String>,
    pub longitude: Option<f32>,
    pub latitude: Option<f32>,
    pub altitude: Option<f32>,
    pub location: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub orientation: Option<Orientation>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub lens: Option<String>,
    pub photographer: Option<String>,
    pub aperture: Option<f32>,
    pub shutter_speed: Option<String>,
    pub iso: Option<i32>,
    pub focal_length: Option<f32>,
    pub rating: Option<i32>,
    // pub file: Option<MediaViewFile>,
}
