use std::{
    cmp::{max, min},
    path::Path,
    result,
    str::FromStr,
};

use chrono::{DateTime, LocalResult, NaiveDateTime, TimeZone, Timelike, Utc};
use chrono_tz::Tz;
use lazy_static::lazy_static;
use lexical_parse_float::FromLexical;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{from_str, Value};
use tokio::fs::read_to_string;
use tracing::{error, info, instrument, warn};
use tzf_rs::DefaultFinder;

use super::{
    db::DbConnection,
    models::{AlternateFileType, MediaFile, MediaItem},
    path::MediaFilePath,
};
use crate::{Config, Result};

lazy_static! {
    static ref FINDER: DefaultFinder = DefaultFinder::new();
}

// exiftool -n -c '%+.6f' -json

pub(crate) const METADATA_FILE: &str = "metadata.json";
pub(crate) const PROCESS_VERSION: i32 = 4;

const EXIF_FORMAT: &str = "%Y:%m:%d %H:%M:%S%.f";
const ISO_FORMAT: &str = "%Y-%m-%dT%H:%M:%S%.f";

pub(crate) fn alternates_for_mimetype(
    config: &Config,
    mimetype: &str,
) -> Vec<(AlternateFileType, String, Option<i32>)> {
    let mut alternates = Vec::new();

    for size in config.thumbnails.sizes.iter() {
        alternates.push((
            AlternateFileType::Thumbnail,
            "image/jpeg".to_string(),
            Some(*size as i32),
        ));

        for alternate_mime in config.thumbnails.alternate_types.iter() {
            alternates.push((
                AlternateFileType::Thumbnail,
                alternate_mime.clone(),
                Some(*size as i32),
            ));
        }
    }

    for alternate_mime in config.thumbnails.alternate_types.iter() {
        alternates.push((AlternateFileType::Reencode, alternate_mime.clone(), None));
    }

    if mimetype.starts_with("video/") {
        alternates.push((AlternateFileType::Reencode, "video/mp4".to_string(), None))
    }

    alternates
}

pub(crate) fn lookup_timezone(longitude: f64, latitude: f64) -> Option<String> {
    Some(FINDER.get_tz_name(longitude, latitude).to_owned())
}

fn time_from_taken(taken: Option<NaiveDateTime>, zone: &Option<String>) -> Option<DateTime<Utc>> {
    if let Some(dt) = taken {
        if let Some(zone) = zone {
            match zone.parse::<Tz>() {
                Ok(offset) => match offset.from_local_datetime(&dt) {
                    LocalResult::Single(dt) => Some(dt.with_timezone(&Utc)),
                    LocalResult::Ambiguous(dt1, _) => {
                        warn!(datetime = %dt, zone, "Ambiguous time found");
                        Some(dt1.with_timezone(&Utc))
                    }
                    LocalResult::None => Some(dt.and_utc()),
                },
                Err(_) => {
                    warn!(offset = zone, "Failed to parse timezone offset");
                    Some(dt.and_utc())
                }
            }
        } else {
            Some(dt.and_utc())
        }
    } else {
        None
    }
}

pub(crate) fn media_datetime(
    media_item: &MediaItem,
    media_file: Option<&MediaFile>,
) -> DateTime<Utc> {
    let taken = media_item.taken.or(media_file.and_then(|f| f.taken));
    let taken_zone = &media_item.taken_zone;
    if let Some(dt) = time_from_taken(taken, taken_zone) {
        dt
    } else {
        media_item.created
    }
}

fn ignore_empty(st: Option<String>) -> Option<String> {
    st.and_then(|s| if s.is_empty() { None } else { Some(s) })
}

fn parse_prefix(st: &str) -> Option<f32> {
    match f32::from_lexical_partial(st.as_bytes()) {
        Ok((val, _)) => Some(val),
        Err(_) => {
            warn!(value = st, "Failed to parse numeric prefix");
            None
        }
    }
}

#[allow(clippy::ptr_arg)]
fn pretty_make(name: &String) -> String {
    match name.as_str() {
        "NIKON CORPORATION" | "NIKON" => "Nikon".to_string(),
        "SAMSUNG" | "Samsung Techwin" => "Samsung".to_string(),
        "OLYMPUS IMAGING CORP." => "Olympus".to_string(),
        "EASTMAN KODAK COMPANY" => "Kodak".to_string(),
        "SONY" => "Sony".to_string(),
        _ => name.clone(),
    }
}

pub(crate) fn deserialize_gps<'de, D>(deserializer: D) -> result::Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = match Value::deserialize(deserializer) {
        Ok(v) => v,
        Err(e) => {
            warn!(error=?e, "Failed to deserialize gps value");
            return Ok(None);
        }
    };

    match value {
        Value::Number(n) => Ok(n.as_f64()),
        Value::String(s) => {
            let result = if let Some(s) = s.strip_prefix('+') {
                f64::from_str(s)
            } else {
                f64::from_str(&s)
            };

            if let Ok(v) = result {
                Ok(Some(v))
            } else {
                warn!(value = s, "Failed to deserialize gps value");
                Ok(None)
            }
        }
        _ => {
            warn!(value = ?value, "Failed to deserialize gps value");
            Ok(None)
        }
    }
}

pub(crate) fn deserialize_datetime<'de, D>(
    deserializer: D,
) -> result::Result<Option<NaiveDateTime>, D::Error>
where
    D: Deserializer<'de>,
{
    let str = match String::deserialize(deserializer) {
        Ok(s) => s,
        Err(e) => {
            warn!(error=?e, "Failed to deserialize datetime");
            return Ok(None);
        }
    };

    if let Ok((dt, _)) = NaiveDateTime::parse_and_remainder(&str, ISO_FORMAT) {
        return Ok(Some(dt));
    }

    match NaiveDateTime::parse_and_remainder(&str, EXIF_FORMAT) {
        Ok((dt, _)) => Ok(Some(dt)),
        Err(_) => {
            warn!(value = str, "Failed to deserialize datetime");
            Ok(None)
        }
    }
}

pub(crate) fn deserialize_orientation<'de, D>(
    deserializer: D,
) -> result::Result<Option<i32>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = match Value::deserialize(deserializer) {
        Ok(v) => v,
        Err(e) => {
            warn!(error=?e, "Failed to deserialize orientation");
            return Ok(None);
        }
    };

    match value {
        Value::Number(n) => match n.as_i64() {
            Some(i) => Ok(Some(i as i32)),
            None => {
                warn!(value = ?n, "Failed to deserialize orientation");
                Ok(None)
            }
        },
        Value::String(s) => match s.to_lowercase().as_str() {
            "top-left" => Ok(Some(1)),
            "top-right" => Ok(Some(2)),
            "bottom-right" => Ok(Some(3)),
            "bottom-left" => Ok(Some(4)),
            "left-top" => Ok(Some(5)),
            "right-top" => Ok(Some(6)),
            "right-bottom" => Ok(Some(7)),
            "left-bottom" => Ok(Some(8)),
            _ => {
                warn!(value = s, "Failed to deserialize orientation");
                Ok(None)
            }
        },
        _ => {
            warn!(value=?value, "Failed to deserialize orientation");
            Ok(None)
        }
    }
}

// pub(crate) fn deserialize_date<'de, D>(deserializer: D) -> Result<Option<Date>, D::Error>
// where
//     D: Deserializer<'de>,
// {
//     let str = match String::deserialize(deserializer) {
//         Ok(s) => s,
//         Err(e) => {
//             warn!(error=?e, "Failed to deserialize date");
//             return Ok(None);
//         }
//     };

//     match Date::parse(&str, &Iso8601::DATE) {
//         Ok(date) => Ok(Some(date)),
//         Err(e) => {
//             warn!(value = str, "Failed to deserialize date");
//             Ok(None)
//         }
//     }
// }

// pub(crate) fn deserialize_time<'de, D>(deserializer: D) -> Result<Option<Time>, D::Error>
// where
//     D: Deserializer<'de>,
// {
//     let str = match String::deserialize(deserializer) {
//         Ok(s) => s,
//         Err(e) => {
//             warn!(error=?e, "Failed to deserialize time");
//             return Ok(None);
//         }
//     };

//     match Time::parse(&str, &Iso8601::TIME) {
//         Ok(time) => Ok(Some(time)),
//         Err(e) => {
//             warn!(value = str, "Failed to deserialize time");
//             Ok(None)
//         }
//     }
// }

// pub(crate) fn deserialize_offset<'de, D>(deserializer: D) -> Result<Option<UtcOffset>, D::Error>
// where
//     D: Deserializer<'de>,
// {
//     let str = match String::deserialize(deserializer) {
//         Ok(s) => s,
//         Err(e) => {
//             warn!(error=?e, "Failed to deserialize offset");
//             return Ok(None);
//         }
//     };

//     match UtcOffset::parse(&str, &Iso8601::OFFSET) {
//         Ok(offset) => Ok(Some(offset)),
//         Err(e) => {
//             warn!(value = str, "Failed to deserialize offset");
//             Ok(None)
//         }
//     }
// }

pub(crate) fn deserialize_subsecs<'de, D>(deserializer: D) -> result::Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Value::deserialize(deserializer)?;
    let str = match value {
        Value::Number(n) => format!("0.{n}"),
        Value::String(s) => format!("0.{s}"),
        _ => {
            warn!(value=?value, "Failed to deserialize subsecs");
            return Ok(None);
        }
    };

    match f64::from_str(&str) {
        Ok(v) => Ok(Some(v)),
        Err(_) => {
            warn!(value = str, "Failed to deserialize subsecs");
            Ok(None)
        }
    }
}

pub(crate) fn number_as_string<'de, D>(deserializer: D) -> result::Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = Value::deserialize(deserializer)?;
    match value {
        Value::Number(n) => Ok(Some(n.to_string())),
        Value::String(s) => Ok(Some(s.clone())),
        _ => {
            warn!(value=?value, "Failed to deserialize float or string");
            Ok(None)
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Metadata {
    pub(crate) exif: Value,
    pub(crate) file_name: String,
    pub(crate) file_size: i32,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) uploaded: DateTime<Utc>,
    pub(crate) mimetype: String,
    pub(crate) duration: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
}

impl Metadata {
    pub(crate) fn media_file(&self, media_item: &str, id: &str) -> MediaFile {
        let mut media_file = MediaFile {
            id: id.to_owned(),
            uploaded: self.uploaded,
            process_version: PROCESS_VERSION,
            file_name: self.file_name.clone(),
            file_size: self.file_size,
            mimetype: self.mimetype.clone(),
            width: self.width,
            height: self.height,
            duration: self.duration,
            frame_rate: self.frame_rate,
            bit_rate: self.bit_rate,
            filename: Some(self.file_name.clone()),
            title: None,
            description: None,
            label: None,
            category: None,
            location: None,
            city: None,
            state: None,
            country: None,
            make: None,
            model: None,
            lens: None,
            photographer: None,
            shutter_speed: None,
            orientation: None,
            iso: None,
            rating: None,
            longitude: None,
            latitude: None,
            altitude: None,
            aperture: None,
            focal_length: None,
            taken: None,
            media_item: media_item.to_owned(),
        };

        // serde_aux doesn't work with converting directly from a Value so roundtrip
        // through a serialized string.
        match serde_json::from_str::<Exif>(&self.exif.to_string()) {
            Ok(exif) => {
                media_file.title = ignore_empty(exif.title.clone());
                media_file.description = ignore_empty(
                    exif.description
                        .as_ref()
                        .or(exif.image_description.as_ref())
                        .or(exif.caption_abstract.as_ref())
                        .cloned(),
                );
                media_file.label = ignore_empty(exif.label.clone());
                media_file.category = ignore_empty(exif.category.clone());

                media_file.taken = exif.parse_taken();

                media_file.longitude = exif.gps_longitude.map(|n| n as f32);
                media_file.latitude = exif.gps_latitude.map(|n| n as f32);
                media_file.altitude = exif.gps_altitude.and_then(|n| parse_prefix(&n));

                media_file.location = ignore_empty(
                    exif.location
                        .as_ref()
                        .or(exif.sub_location.as_ref())
                        .cloned(),
                );
                media_file.city = ignore_empty(exif.city.clone());
                media_file.state = ignore_empty(
                    exif.state
                        .as_ref()
                        .or(exif.province_state.as_ref())
                        .cloned(),
                );
                media_file.country = ignore_empty(
                    exif.country
                        .as_ref()
                        .or(exif.country_location.as_ref())
                        .cloned(),
                );

                media_file.orientation = if self.mimetype.starts_with("image/") {
                    exif.orientation
                } else {
                    Some(1)
                };

                media_file.make = ignore_empty(
                    exif.make
                        .as_ref()
                        .or(exif.android_manufacturer.as_ref())
                        .map(pretty_make),
                );
                media_file.model =
                    ignore_empty(exif.model.as_ref().or(exif.android_model.as_ref()).cloned());
                media_file.lens =
                    ignore_empty(exif.lens.as_ref().or(exif.lens_model.as_ref()).cloned());

                media_file.photographer = ignore_empty(
                    exif.creator
                        .and_then(|c| {
                            if c.is_empty() {
                                None
                            } else {
                                Some(c.join(", "))
                            }
                        })
                        .as_ref()
                        .or(exif.artist.as_ref())
                        .or(exif.by_line.as_ref())
                        .cloned(),
                );

                media_file.aperture = exif.f_number.or(exif.aperture_value);
                media_file.shutter_speed = ignore_empty(
                    exif.exposure_time
                        .as_ref()
                        .or(exif.shutter_speed.as_ref())
                        .or(exif.shutter_speed_value.as_ref())
                        .cloned(),
                );
                media_file.iso = exif.iso;
                media_file.focal_length = exif.focal_length.as_deref().and_then(parse_prefix);

                media_file.rating = exif
                    .rating_percent
                    .map(|p| (5.0 * p / 100.0).round() as i32)
                    .or(exif.rating.map(|r| max(0, min(5, r))))
            }
            Err(e) => {
                warn!(media_item=media_item, media_file=id, error=?e, "Failed to parse EXIF data")
            }
        }

        media_file
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub(crate) struct Exif {
    // Combined gives the correct time but the timezone is that of the exporting
    // device.
    // #[serde(default, deserialize_with = "deserialize_datetime")]
    // pub(crate) create_date: Option<NaiveDateTime>,
    // #[serde(default, deserialize_with = "deserialize_offset")]
    // pub(crate) offset_time: Option<UtcOffset>,

    // Correct time, wrong (or no) timezone.
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) date_time_created: Option<NaiveDateTime>,
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) date_time_original: Option<NaiveDateTime>,
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) date_created: Option<NaiveDateTime>,
    // Only the time part.
    // #[serde(default, deserialize_with = "deserialize_time")]
    // pub(crate) time_created: Option<Time>,

    // The correct time using the timezone of the exporting device.
    // #[serde(default, deserialize_with = "deserialize_datetime")]
    // pub(crate) digital_creation_date_time: Option<NaiveDateTime>,
    // #[serde(default, deserialize_with = "deserialize_date")]
    // pub(crate) digital_creation_date: Option<Date>,
    // #[serde(default, deserialize_with = "deserialize_time")]
    // pub(crate) digital_creation_time: Option<Time>,

    // The correct time using the local time of the exporting device.
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) sub_sec_create_date: Option<NaiveDateTime>,
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) sub_sec_date_time_original: Option<NaiveDateTime>,

    #[serde(default, deserialize_with = "deserialize_subsecs")]
    pub(crate) sub_sec_time_original: Option<f64>,
    #[serde(default, deserialize_with = "deserialize_subsecs")]
    pub(crate) sub_sec_time_digitized: Option<f64>,

    // The timezone offset of the exporting device.
    // #[serde(default, deserialize_with = "deserialize_offset")]
    // pub(crate) offset_time_original: Option<UtcOffset>,
    // #[serde(default, deserialize_with = "deserialize_offset")]
    // pub(crate) offset_time_digitized: Option<UtcOffset>,

    // GPS coordinates
    #[serde(default, rename = "GPSLatitude", deserialize_with = "deserialize_gps")]
    pub(crate) gps_latitude: Option<f64>,
    #[serde(default, rename = "GPSLongitude", deserialize_with = "deserialize_gps")]
    pub(crate) gps_longitude: Option<f64>,
    #[serde(default, rename = "GPSAltitude", deserialize_with = "number_as_string")]
    pub(crate) gps_altitude: Option<String>,

    pub(crate) title: Option<String>,

    pub(crate) description: Option<String>,
    pub(crate) image_description: Option<String>,
    #[serde(rename = "Caption-Abstract")]
    pub(crate) caption_abstract: Option<String>,

    pub(crate) label: Option<String>,

    pub(crate) category: Option<String>,

    pub(crate) location: Option<String>,
    #[serde(rename = "Sub-location")]
    pub(crate) sub_location: Option<String>,

    pub(crate) city: Option<String>,

    pub(crate) state: Option<String>,
    #[serde(rename = "Province-State")]
    pub(crate) province_state: Option<String>,

    pub(crate) country: Option<String>,
    #[serde(rename = "Country-PrimaryLocationName")]
    pub(crate) country_location: Option<String>,

    #[serde(default, deserialize_with = "deserialize_orientation")]
    pub(crate) orientation: Option<i32>,

    pub(crate) make: Option<String>,
    pub(crate) android_manufacturer: Option<String>,

    pub(crate) model: Option<String>,
    pub(crate) android_model: Option<String>,

    pub(crate) lens: Option<String>,
    pub(crate) lens_model: Option<String>,

    pub(crate) creator: Option<Vec<String>>,
    pub(crate) artist: Option<String>,
    #[serde(rename = "By-line")]
    pub(crate) by_line: Option<String>,

    pub(crate) f_number: Option<f32>,
    pub(crate) aperture_value: Option<f32>,

    #[serde(default, deserialize_with = "number_as_string")]
    pub(crate) exposure_time: Option<String>,
    #[serde(default, deserialize_with = "number_as_string")]
    pub(crate) shutter_speed: Option<String>,
    #[serde(default, deserialize_with = "number_as_string")]
    pub(crate) shutter_speed_value: Option<String>,

    #[serde(rename = "ISO")]
    pub(crate) iso: Option<i32>,

    pub(crate) focal_length: Option<String>,

    pub(crate) rating_percent: Option<f32>,
    pub(crate) rating: Option<i32>,
}

impl Exif {
    pub(crate) fn parse_taken(&self) -> Option<NaiveDateTime> {
        let nanos = self
            .sub_sec_time_original
            .or(self.sub_sec_time_digitized)
            .map(|ss| (ss * 1_000_000_000_f64) as u32)
            .or_else(|| {
                self.sub_sec_create_date
                    .or(self.sub_sec_date_time_original)
                    .map(|dt| dt.nanosecond())
            })
            .unwrap_or_default();

        self.date_time_created
            .or(self.date_time_original)
            .or(self.date_created)
            .map(|dt| dt.with_nanosecond(nanos).unwrap())
    }
}

pub(crate) async fn parse_metadata(metadata_file: &Path) -> Result<Metadata> {
    let str = read_to_string(metadata_file).await?;
    Ok(from_str::<Metadata>(&str)?)
}

pub(crate) async fn process_media(config: &Config, file_path: &MediaFilePath) -> Result<MediaFile> {
    let metadata_file = config
        .local_store()
        .local_path(file_path)
        .join(METADATA_FILE);
    let metadata = parse_metadata(&metadata_file).await?;

    Ok(metadata.media_file(&file_path.item, &file_path.file))
}

#[instrument(skip_all)]
pub(crate) async fn reprocess_all_media(tx: &mut DbConnection<'_>) -> Result<()> {
    info!("Reprocessing media metadata");

    let current_files = MediaFile::list_current(tx).await?;

    let mut media_files = Vec::new();

    for (media_file, file_path) in current_files {
        let media_file = if media_file.process_version != PROCESS_VERSION {
            match process_media(tx.config(), &file_path).await {
                Ok(media_file) => media_file,
                Err(e) => {
                    error!(media = media_file.media_item, error = ?e, "Failed to process media metadata");
                    continue;
                }
            }
        } else {
            media_file
        };

        media_files.push(media_file);
    }

    MediaFile::upsert(tx, &media_files).await?;

    let mut media_items = MediaItem::list_unprocessed(tx).await?;
    for item in media_items.iter_mut() {
        item.sync_with_file(None);
    }

    MediaItem::upsert(tx, &media_items).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use serde_json::from_str;

    use super::Exif;
    use crate::store::metadata::lookup_timezone;

    #[test]
    fn parse_exif() {
        let exif = from_str::<Exif>(
            r#"{
                "ModifyDate": "2020:11:27 08:25:18",
                "DateTimeOriginal": "2013:08:29 17:41:06",
                "CreateDate": "2013:08:29 08:41:06",
                "OffsetTime": "-08:00",
                "SubSecTimeDigitized": 70,
                "GPSVersionID": "2 2 0 0",
                "GPSLatitudeRef": "N",
                "GPSLongitudeRef": "E",
                "GPSAltitude": 73.6999,
                "TimeCreated": "17:41:06",
                "DigitalCreationDate": "2013:08:29",
                "DigitalCreationTime": "08:41:06",
                "DateCreated": "2013:08:29 17:41:06",
                "SubSecCreateDate": "2013:08:29 08:41:06.70",
                "SubSecModifyDate": "2020:11:27 08:25:18-08:00",
                "GPSLatitude": 48.8608032616667,
                "GPSLongitude": 2.33539117333333,
                "DateTimeCreated": "2013:08:29 17:41:06",
                "DigitalCreationDateTime": "2013:08:29 08:41:06",
                "GPSPosition": "48.8608032616667 2.33539117333333"
            }"#,
        )
        .unwrap();

        let taken = exif.parse_taken().unwrap();
        assert_eq!(
            taken,
            NaiveDate::from_ymd_opt(2013, 8, 29)
                .unwrap()
                .and_hms_milli_opt(17, 41, 6, 700)
                .unwrap()
        );
        assert_eq!(
            lookup_timezone(exif.gps_longitude.unwrap(), exif.gps_latitude.unwrap()).as_deref(),
            Some("Europe/Paris")
        );

        let exif = from_str::<Exif>(
            r#"{
                "GPSVersionID": "2 2 0 0",
                "GPSLatitudeRef": "N",
                "GPSLongitudeRef": "E",
                "GPSAltitude": 74.1,
                "GPSLatitude": 48.8609391816667,
                "GPSLongitude": 2.33555336333333,
                "GPSPosition": "48.8609391816667 2.33555336333333",
                "ModifyDate": "2020-11-27T08:25:22.000-08:00",
                "DateTimeOriginal": "2013-08-29T17:42:25.000-08:00",
                "CreateDate": "2013-08-29T08:42:25.000-08:00",
                "OffsetTime": "-08:00",
                "SubSecTimeDigitized": 60,
                "TimeCreated": "17:42:25",
                "DigitalCreationDate": "2013-08-29",
                "DigitalCreationTime": "08:42:25",
                "SubSecCreateDate": "2013-08-29T08:42:25.600-08:00",
                "SubSecModifyDate": "2020-11-27T08:25:22.000-08:00",
                "DateTimeCreated": "2013-08-29T17:42:25.000-08:00",
                "DigitalCreationDateTime": "2013-08-29T08:42:25.000-08:00"
            }"#,
        )
        .unwrap();

        let taken = exif.parse_taken().unwrap();
        assert_eq!(
            taken,
            NaiveDate::from_ymd_opt(2013, 8, 29)
                .unwrap()
                .and_hms_milli_opt(17, 42, 25, 600)
                .unwrap()
        );
        assert_eq!(
            lookup_timezone(exif.gps_longitude.unwrap(), exif.gps_latitude.unwrap()).as_deref(),
            Some("Europe/Paris")
        );

        let exif = from_str::<Exif>(
            r#"{
                "ModifyDate": "2023:11:01 17:45:39",
                "DateTimeOriginal": "2023:11:01 17:45:39",
                "CreateDate": "2023:11:01 17:45:39",
                "OffsetTime": "+00:00",
                "OffsetTimeOriginal": "+00:00",
                "OffsetTimeDigitized": "+00:00",
                "SubSecTime": 805,
                "SubSecTimeOriginal": 805,
                "SubSecTimeDigitized": 805,
                "GPSVersionID": "2.2.0.0",
                "GPSLatitudeRef": "North",
                "GPSLongitudeRef": "West",
                "GPSAltitudeRef": "Above Sea Level",
                "GPSTimeStamp": "17:44:38",
                "GPSDOP": 12.556,
                "GPSImgDirectionRef": "Magnetic North",
                "GPSImgDirection": 69,
                "GPSProcessingMethod": "fused",
                "GPSDateStamp": "2023:11:01",
                "SubSecCreateDate": "2023:11:01 17:45:39.805+00:00",
                "SubSecDateTimeOriginal": "2023:11:01 17:45:39.805+00:00",
                "SubSecModifyDate": "2023:11:01 17:45:39.805+00:00",
                "GPSAltitude": "95.9 m Above Sea Level",
                "GPSDateTime": "2023:11:01 17:44:38Z",
                "GPSLatitude": "+52.747325",
                "GPSLongitude": -1.176903,
                "GPSPosition": "+52.747325, -1.176903"
            }"#,
        )
        .unwrap();

        let taken = exif.parse_taken().unwrap();
        assert_eq!(
            taken,
            NaiveDate::from_ymd_opt(2023, 11, 1)
                .unwrap()
                .and_hms_milli_opt(17, 45, 39, 805)
                .unwrap()
        );
        assert_eq!(exif.gps_longitude, Some(-1.176903));
        assert_eq!(exif.gps_latitude, Some(52.747325));
        assert_eq!(
            lookup_timezone(exif.gps_longitude.unwrap(), exif.gps_latitude.unwrap()).as_deref(),
            Some("Europe/London")
        );

        let exif = from_str::<Exif>(
            r#"{
                "ModifyDate": "2023:08:09 12:18:56",
                "DateTimeOriginal": "2023:08:09 12:18:56",
                "CreateDate": "2023:08:09 12:18:56",
                "OffsetTime": "-07:00",
                "OffsetTimeOriginal": "-07:00",
                "OffsetTimeDigitized": "-07:00",
                "SubSecTime": 773958,
                "SubSecTimeOriginal": 773958,
                "SubSecTimeDigitized": 773958,
                "GPSVersionID": "2.2.0.0",
                "GPSLatitudeRef": "North",
                "GPSLongitudeRef": "West",
                "GPSAltitudeRef": "Below Sea Level",
                "GPSTimeStamp": "19:18:52",
                "GPSDOP": 10.86,
                "GPSProcessingMethod": "fused",
                "GPSDateStamp": "2023:08:09",
                "SubSecCreateDate": "2023:08:09 12:18:56.773958-07:00",
                "SubSecDateTimeOriginal": "2023:08:09 12:18:56.773958-07:00",
                "SubSecModifyDate": "2023:08:09 12:18:56.773958-07:00",
                "GPSAltitude": "0 m Below Sea Level",
                "GPSDateTime": "2023:08:09 19:18:52Z",
                "GPSLatitude": "+34.209665",
                "GPSLongitude": -119.078521
            }"#,
        )
        .unwrap();
        assert_eq!(
            lookup_timezone(exif.gps_longitude.unwrap(), exif.gps_latitude.unwrap()).as_deref(),
            Some("America/Los_Angeles")
        );

        let taken = exif.parse_taken().unwrap();
        assert_eq!(
            taken,
            NaiveDate::from_ymd_opt(2023, 8, 9)
                .unwrap()
                .and_hms_micro_opt(12, 18, 56, 773958)
                .unwrap()
        );
    }
}
