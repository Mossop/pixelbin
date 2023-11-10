use std::{cmp::min, collections::HashMap};

use chrono::{DateTime, NaiveDateTime, Timelike, Utc};
use diesel::{
    backend, delete, deserialize, insert_into, prelude::*, serialize, sql_types, upsert::excluded,
    AsExpression, Queryable,
};
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use serde::Serialize;
use serde_repr::Serialize_repr;
use tracing::instrument;
use typeshare::typeshare;

use super::metadata::{lookup_timezone, media_datetime};
use super::{
    aws::AwsClient,
    db::{functions::media_view, search::FilterGen},
    DbConnection, MediaFilePath, RemotePath,
};
use super::{db::schema::*, db::search::CompoundQueryItem};
use crate::Result;

struct Batch<'a, T> {
    slice: &'a [T],
    pos: usize,
    count: usize,
}

impl<'a, T> Iterator for Batch<'a, T> {
    type Item = &'a [T];

    fn next(&mut self) -> Option<Self::Item> {
        if self.pos >= self.slice.len() {
            None
        } else {
            let end = min(self.slice.len(), self.pos + self.count);
            let next = &self.slice[self.pos..end];
            self.pos = end;
            Some(next)
        }
    }
}

fn batch<T>(slice: &[T], count: usize) -> Batch<T> {
    Batch {
        slice,
        pos: 0,
        count,
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
    fn from_sql(bytes: DB::RawValue<'_>) -> deserialize::Result<Self> {
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
    fn from_sql(bytes: DB::RawValue<'_>) -> deserialize::Result<Self> {
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

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub struct User {
    pub email: String,
    #[serde(skip)]
    pub(crate) password: Option<String>,
    pub fullname: Option<String>,
    pub administrator: bool,
    #[typeshare(serialized_as = "string")]
    pub created: DateTime<Utc>,
    #[typeshare(serialized_as = "string")]
    pub last_login: Option<DateTime<Utc>>,
    pub verified: Option<bool>,
}

#[typeshare]
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

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Catalog {
    pub id: String,
    pub name: String,
    pub storage: String,
}

impl Catalog {
    #[instrument(skip(self, conn), fields(catalog = self.id))]
    pub async fn list_media(
        &self,
        conn: &mut AsyncPgConnection,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<MediaView>> {
        if let Some(count) = count {
            Ok(media_view!()
                .filter(media_item::catalog.eq(&self.id))
                .offset(offset.unwrap_or_default())
                .limit(count)
                .load::<MediaView>(conn)
                .await?)
        } else {
            Ok(media_view!()
                .filter(media_item::catalog.eq(&self.id))
                .offset(offset.unwrap_or_default())
                .load::<MediaView>(conn)
                .await?)
        }
    }
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Person {
    pub id: String,
    pub name: String,
    pub catalog: String,
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Tag {
    pub id: String,
    pub parent: Option<String>,
    pub name: String,
    pub catalog: String,
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub struct Album {
    pub id: String,
    pub parent: Option<String>,
    pub name: String,
    pub catalog: String,
}

impl Album {
    #[instrument(skip(self, conn), fields(album = self.id))]
    pub async fn list_media(
        &self,
        conn: &mut AsyncPgConnection,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<MediaView>> {
        if let Some(count) = count {
            Ok(media_view!()
                .inner_join(media_album::table.on(media_item::id.eq(media_album::media)))
                .filter(media_album::album.eq(&self.id))
                .offset(offset.unwrap_or_default())
                .limit(count)
                .load::<MediaView>(conn)
                .await?)
        } else {
            Ok(media_view!()
                .inner_join(media_album::table.on(media_item::id.eq(media_album::media)))
                .filter(media_album::album.eq(&self.id))
                .offset(offset.unwrap_or_default())
                .load::<MediaView>(conn)
                .await?)
        }
    }
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
pub struct SavedSearch {
    pub id: String,
    pub name: String,
    pub shared: bool,
    pub query: CompoundQueryItem,
    pub catalog: String,
}

#[derive(Insertable)]
#[diesel(table_name = media_search)]
struct MediaSearch {
    catalog: String,
    media: String,
    search: String,
    added: DateTime<Utc>,
}

impl SavedSearch {
    #[instrument(skip(self, conn), fields(search = self.id))]
    pub async fn list_media(
        &self,
        conn: &mut AsyncPgConnection,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<MediaView>> {
        if let Some(count) = count {
            Ok(media_view!()
                .inner_join(media_search::table.on(media_item::id.eq(media_search::media)))
                .filter(media_search::search.eq(&self.id))
                .offset(offset.unwrap_or_default())
                .limit(count)
                .load::<MediaView>(conn)
                .await?)
        } else {
            Ok(media_view!()
                .inner_join(media_search::table.on(media_item::id.eq(media_search::media)))
                .filter(media_search::search.eq(&self.id))
                .offset(offset.unwrap_or_default())
                .load::<MediaView>(conn)
                .await?)
        }
    }

    #[instrument(skip(self, conn), fields(search = self.id))]
    pub(crate) async fn update(&self, conn: &mut AsyncPgConnection) -> Result {
        let select = media_item::table
            .left_outer_join(
                media_file::table.on(media_item::media_file.eq(media_file::id.nullable())),
            )
            .filter(media_item::catalog.eq(&self.catalog))
            .filter(self.query.filter_gen(&self.catalog))
            .select(media_item::id)
            .distinct();

        let matching_media = select.load::<String>(conn).await?;

        let now = Utc::now();

        let inserts: Vec<MediaSearch> = matching_media
            .iter()
            .map(|id| MediaSearch {
                catalog: self.catalog.clone(),
                media: id.to_owned(),
                search: self.id.to_string(),
                added: now,
            })
            .collect();

        insert_into(media_search::table)
            .values(inserts)
            .on_conflict_do_nothing()
            .execute(conn)
            .await?;

        delete(
            media_search::table
                .filter(media_search::search.eq(&self.id))
                .filter(media_search::media.ne_all(matching_media)),
        )
        .execute(conn)
        .await?;

        Ok(())
    }
}

fn clear_matching<T: PartialEq>(field: &mut Option<T>, reference: &Option<T>) {
    if field == reference {
        *field = None;
    }
}

#[derive(Queryable, Insertable, Clone, Debug)]
#[diesel(table_name = media_item)]
pub struct MediaItem {
    pub id: String,
    pub deleted: bool,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub datetime: DateTime<Utc>,
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
    pub taken: Option<NaiveDateTime>,
    pub catalog: String,
    pub media_file: Option<String>,
}

impl MediaItem {
    #[instrument(skip_all)]
    pub async fn upsert(conn: &mut DbConnection<'_>, media_items: &[MediaItem]) -> Result {
        for records in batch(media_items, 500) {
            diesel::insert_into(media_item::table)
                .values(records)
                .on_conflict(media_item::id)
                .do_update()
                .set((
                    media_item::deleted.eq(excluded(media_item::deleted)),
                    media_item::created.eq(excluded(media_item::created)),
                    media_item::updated.eq(excluded(media_item::updated)),
                    media_item::datetime.eq(excluded(media_item::datetime)),
                    media_item::filename.eq(excluded(media_item::filename)),
                    media_item::title.eq(excluded(media_item::title)),
                    media_item::description.eq(excluded(media_item::description)),
                    media_item::label.eq(excluded(media_item::label)),
                    media_item::category.eq(excluded(media_item::category)),
                    media_item::location.eq(excluded(media_item::location)),
                    media_item::city.eq(excluded(media_item::city)),
                    media_item::state.eq(excluded(media_item::state)),
                    media_item::country.eq(excluded(media_item::country)),
                    media_item::make.eq(excluded(media_item::make)),
                    media_item::model.eq(excluded(media_item::model)),
                    media_item::lens.eq(excluded(media_item::lens)),
                    media_item::photographer.eq(excluded(media_item::photographer)),
                    media_item::shutter_speed.eq(excluded(media_item::shutter_speed)),
                    media_item::taken_zone.eq(excluded(media_item::taken_zone)),
                    media_item::orientation.eq(excluded(media_item::orientation)),
                    media_item::iso.eq(excluded(media_item::iso)),
                    media_item::rating.eq(excluded(media_item::rating)),
                    media_item::longitude.eq(excluded(media_item::longitude)),
                    media_item::latitude.eq(excluded(media_item::latitude)),
                    media_item::altitude.eq(excluded(media_item::altitude)),
                    media_item::aperture.eq(excluded(media_item::aperture)),
                    media_item::focal_length.eq(excluded(media_item::focal_length)),
                    media_item::taken.eq(excluded(media_item::taken)),
                    media_item::media_file.eq(excluded(media_item::media_file)),
                ))
                .execute(conn.conn)
                .await?;
        }

        Ok(())
    }

    fn sync_with_file(&mut self, media_file: &MediaFile) {
        clear_matching(&mut self.filename, &media_file.filename);
        clear_matching(&mut self.title, &media_file.title);
        clear_matching(&mut self.description, &media_file.description);
        clear_matching(&mut self.label, &media_file.label);
        clear_matching(&mut self.category, &media_file.category);
        clear_matching(&mut self.location, &media_file.location);
        clear_matching(&mut self.city, &media_file.city);
        clear_matching(&mut self.state, &media_file.state);
        clear_matching(&mut self.country, &media_file.country);
        clear_matching(&mut self.make, &media_file.make);
        clear_matching(&mut self.model, &media_file.model);
        clear_matching(&mut self.lens, &media_file.lens);
        clear_matching(&mut self.photographer, &media_file.photographer);
        clear_matching(&mut self.shutter_speed, &media_file.shutter_speed);
        clear_matching(&mut self.taken_zone, &media_file.taken_zone);
        clear_matching(&mut self.orientation, &media_file.orientation);
        clear_matching(&mut self.iso, &media_file.iso);
        clear_matching(&mut self.rating, &media_file.rating);
        clear_matching(&mut self.longitude, &media_file.longitude);
        clear_matching(&mut self.latitude, &media_file.latitude);
        clear_matching(&mut self.altitude, &media_file.altitude);
        clear_matching(&mut self.aperture, &media_file.aperture);
        clear_matching(&mut self.focal_length, &media_file.focal_length);

        // Ignore any sub-second differences.
        if let (Some(item_taken), Some(file_taken)) = (self.taken, media_file.taken) {
            if item_taken.with_nanosecond(0) == file_taken.with_nanosecond(0) {
                self.taken = None;
            }
        }

        match (self.longitude, self.latitude) {
            (Some(longitude), Some(latitude)) => {
                self.taken_zone = lookup_timezone(longitude as f64, latitude as f64)
            }
            _ => self.taken_zone = None,
        }

        self.datetime = media_datetime(self, media_file);
    }
}

#[derive(Queryable, Insertable, Clone, Debug)]
#[diesel(table_name = media_file)]
pub struct MediaFile {
    pub id: String,
    pub uploaded: DateTime<Utc>,
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
    pub taken: Option<NaiveDateTime>,
    pub media: String,
}

impl MediaFile {
    #[instrument(skip_all)]
    pub async fn list_current(
        conn: &mut DbConnection<'_>,
    ) -> Result<Vec<(MediaFile, MediaFilePath)>> {
        let files = media_item::table
            .inner_join(media_file::table.on(media_item::media_file.eq(media_file::id.nullable())))
            .select((media_file::all_columns, media_item::catalog))
            .load::<(MediaFile, String)>(conn.conn)
            .await?;

        Ok(files
            .into_iter()
            .map(|(media_file, catalog)| {
                let media_path = MediaFilePath::new(&catalog, &media_file.media, &media_file.id);
                (media_file, media_path)
            })
            .collect())
    }

    #[instrument(skip_all)]
    pub async fn upsert(conn: &mut DbConnection<'_>, media_files: &[MediaFile]) -> Result {
        conn.assert_in_transaction();

        let media_file_map: HashMap<&String, &MediaFile> =
            media_files.iter().map(|m| (&m.id, m)).collect();
        let media_file_ids: Vec<&&String> = media_file_map.keys().collect();
        let mut items = media_item::table
            .filter(media_item::media_file.eq_any(media_file_ids))
            .select(media_item::all_columns)
            .load::<MediaItem>(conn.conn)
            .await?;

        items.iter_mut().for_each(|item| {
            if let Some(file) = media_file_map.get(item.media_file.as_ref().unwrap()) {
                item.sync_with_file(file);
            }
        });

        for records in batch(media_files, 500) {
            diesel::insert_into(media_file::table)
                .values(records)
                .on_conflict(media_file::id)
                .do_update()
                .set((
                    media_file::uploaded.eq(excluded(media_file::uploaded)),
                    media_file::process_version.eq(excluded(media_file::process_version)),
                    media_file::file_name.eq(excluded(media_file::file_name)),
                    media_file::file_size.eq(excluded(media_file::file_size)),
                    media_file::mimetype.eq(excluded(media_file::mimetype)),
                    media_file::width.eq(excluded(media_file::width)),
                    media_file::height.eq(excluded(media_file::height)),
                    media_file::duration.eq(excluded(media_file::duration)),
                    media_file::frame_rate.eq(excluded(media_file::frame_rate)),
                    media_file::bit_rate.eq(excluded(media_file::bit_rate)),
                    media_file::filename.eq(excluded(media_file::filename)),
                    media_file::title.eq(excluded(media_file::title)),
                    media_file::description.eq(excluded(media_file::description)),
                    media_file::label.eq(excluded(media_file::label)),
                    media_file::category.eq(excluded(media_file::category)),
                    media_file::location.eq(excluded(media_file::location)),
                    media_file::city.eq(excluded(media_file::city)),
                    media_file::state.eq(excluded(media_file::state)),
                    media_file::country.eq(excluded(media_file::country)),
                    media_file::make.eq(excluded(media_file::make)),
                    media_file::model.eq(excluded(media_file::model)),
                    media_file::lens.eq(excluded(media_file::lens)),
                    media_file::photographer.eq(excluded(media_file::photographer)),
                    media_file::shutter_speed.eq(excluded(media_file::shutter_speed)),
                    media_file::taken_zone.eq(excluded(media_file::taken_zone)),
                    media_file::orientation.eq(excluded(media_file::orientation)),
                    media_file::iso.eq(excluded(media_file::iso)),
                    media_file::rating.eq(excluded(media_file::rating)),
                    media_file::longitude.eq(excluded(media_file::longitude)),
                    media_file::latitude.eq(excluded(media_file::latitude)),
                    media_file::altitude.eq(excluded(media_file::altitude)),
                    media_file::aperture.eq(excluded(media_file::aperture)),
                    media_file::focal_length.eq(excluded(media_file::focal_length)),
                    media_file::taken.eq(excluded(media_file::taken)),
                ))
                .execute(conn.conn)
                .await?;
        }

        MediaItem::upsert(conn, &items).await?;

        Ok(())
    }
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

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MediaViewFile {
    pub id: String,
    pub file_size: i32,
    pub mimetype: String,
    pub width: i32,
    pub height: i32,
    pub duration: Option<f32>,
    pub frame_rate: Option<f32>,
    pub bit_rate: Option<f32>,
    pub uploaded: DateTime<Utc>,
    pub file_name: String,
}

#[typeshare]
#[derive(Queryable, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MediaView {
    pub id: String,
    pub catalog: String,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    pub datetime: DateTime<Utc>,
    pub filename: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub label: Option<String>,
    pub category: Option<String>,
    pub taken: Option<NaiveDateTime>,
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
    pub file: Option<MediaViewFile>,
}
