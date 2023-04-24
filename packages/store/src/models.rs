use diesel::{backend, deserialize, sql_types, Queryable};
use time::{OffsetDateTime, PrimitiveDateTime};

use crate::{aws::AwsClient, RemotePath};
use pixelbin_shared::Result;

#[derive(Debug, Clone, Copy, deserialize::FromSqlRow)]
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

#[repr(i32)]
#[derive(Debug, Clone, Copy, deserialize::FromSqlRow)]
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

impl<DB> deserialize::FromSql<sql_types::Integer, DB> for Orientation
where
    DB: backend::Backend,
    i32: deserialize::FromSql<sql_types::Integer, DB>,
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

#[derive(Queryable, Clone, Debug)]
pub struct Storage {
    pub id: String,
    pub name: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub bucket: String,
    pub region: String,
    pub path: Option<String>,
    pub endpoint: Option<String>,
    pub public_url: Option<String>,
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
