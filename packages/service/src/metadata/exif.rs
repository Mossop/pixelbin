use std::{
    cmp::{max, min},
    path::Path,
};

use chrono::{NaiveDateTime, Timelike};
use lexical_parse_float::FromLexical;
use mime::Mime;
use serde::{Deserialize, Serialize};
use serde_json::{from_slice, Map, Number, Value};
use tokio::process::Command;
use tracing::{debug, warn};

use super::ISO_FORMAT;
use crate::{store::models, Error, Result};

const TYPE_NULL: &str = "null";
const TYPE_BOOL: &str = "boolean";
const TYPE_NUMBER: &str = "number";
const TYPE_STRING: &str = "string";
const TYPE_ARRAY: &str = "array";
const TYPE_OBJECT: &str = "object";

const PARSE_VERSION_KEY: &str = "ParseVersion";

const EXIF_FORMAT: &str = "%Y:%m:%d %H:%M:%S%.f";

type Object = Map<String, Value>;

fn type_of(value: &Value) -> &'static str {
    match value {
        Value::Null => TYPE_NULL,
        Value::Bool(_) => TYPE_BOOL,
        Value::Number(_) => TYPE_NUMBER,
        Value::String(_) => TYPE_STRING,
        Value::Array(_) => TYPE_ARRAY,
        Value::Object(_) => TYPE_OBJECT,
    }
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(from = "Object", untagged)]
pub(crate) enum ExifData {
    V1(Object),
    V2(Object),
    Unknown(Object),
}

impl From<Object> for ExifData {
    fn from(object: Object) -> ExifData {
        match object.get(PARSE_VERSION_KEY) {
            Some(Value::Number(version)) => {
                if let Some(version) = version.as_f64() {
                    match version.round() as u32 {
                        2 => ExifData::V2(object),
                        o => {
                            warn!("Unexpected parse version: {}", o);
                            ExifData::Unknown(object)
                        }
                    }
                } else {
                    warn!(
                        "Expected parse version to be an integer got but {}",
                        version
                    );
                    ExifData::Unknown(object)
                }
            }
            Some(val) => {
                warn!(
                    "Expected parse version to be a number got but {}",
                    type_of(val)
                );
                ExifData::Unknown(object)
            }
            None => ExifData::V1(object),
        }
    }
}

impl ExifData {
    pub(crate) async fn parse_media(local_file: &Path) -> Result<Self> {
        let output = Command::new("exiftool")
            .arg("-n")
            .arg("-g")
            .arg("-struct")
            .arg("-c")
            .arg("%.6f")
            .arg("-json")
            .arg(local_file)
            .output()
            .await?;

        if !output.status.success() {
            return Err(Error::Unknown {
                message: format!(
                    "Failed to execute exiftool: {}",
                    std::str::from_utf8(&output.stderr).unwrap()
                ),
            });
        }

        let (mut object,): (Object,) = from_slice(&output.stdout)?;
        object.insert(
            PARSE_VERSION_KEY.to_owned(),
            Value::Number(Number::from_f64(2.0).unwrap()),
        );
        Ok(ExifData::V2(object))
    }
}

fn expect_object(val: &Value) -> Option<&Object> {
    if let Value::Object(obj) = val {
        Some(obj)
    } else {
        None
    }
}

fn expect_prop<'a, 'b>(prop: &'a str) -> impl FnOnce(&'b Object) -> Option<&'b Value> + 'a {
    |obj: &Object| obj.get(prop)
}

fn expect_string(val: &Value) -> Option<String> {
    match val {
        Value::String(ref str) => {
            if str.is_empty() {
                None
            } else {
                Some(str.clone())
            }
        }
        Value::Number(ref num) => Some(num.to_string()),
        _ => None,
    }
}

fn expect_string_array(val: &Value) -> Option<String> {
    match val {
        Value::Array(ref array) => {
            let strings = array
                .iter()
                .filter_map(expect_string)
                .collect::<Vec<String>>();

            if strings.is_empty() {
                None
            } else {
                Some(strings.join(", "))
            }
        }
        Value::String(ref str) => {
            if str.is_empty() {
                None
            } else {
                Some(str.clone())
            }
        }
        Value::Number(ref num) => Some(num.to_string()),
        _ => None,
    }
}

fn expect_subsecs(val: &Value) -> Option<f64> {
    let str = match val {
        Value::Number(n) => format!("0.{n}"),
        Value::String(s) => format!("0.{s}"),
        _ => {
            return None;
        }
    };

    match str.parse::<f64>() {
        Ok(v) => Some(v),
        Err(_) => None,
    }
}

fn expect_datetime(val: &Value) -> Option<NaiveDateTime> {
    if let Value::String(ref str) = val {
        if let Ok((dt, _)) = NaiveDateTime::parse_and_remainder(str, ISO_FORMAT) {
            return Some(dt);
        }

        match NaiveDateTime::parse_and_remainder(str, EXIF_FORMAT) {
            Ok((dt, _)) => Some(dt),
            Err(_) => None,
        }
    } else {
        None
    }
}

fn expect_gps_coord(val: &Value) -> Option<f32> {
    match val {
        Value::Number(n) => n.as_f64().map(|f| f as f32),
        Value::String(s) => {
            let result = if let Some(s) = s.strip_prefix('+') {
                s.parse::<f32>()
            } else {
                s.parse::<f32>()
            };

            if let Ok(v) = result {
                Some(v)
            } else {
                None
            }
        }
        _ => None,
    }
}

fn fix_gps_sign(coord: f32, coord_ref: String) -> f32 {
    let result = match coord_ref[0..1].to_ascii_lowercase().as_str() {
        "s" | "w" => -coord,
        _ => coord,
    };

    debug!(coord, coord_ref, result, "Fixing GPS coordinate");
    result
}

fn expect_orientation(val: &Value) -> Option<i32> {
    match val {
        Value::Number(n) => n.as_i64().map(|i| i as i32),
        Value::String(s) => match s.to_lowercase().as_str() {
            "top-left" => Some(1),
            "top-right" => Some(2),
            "bottom-right" => Some(3),
            "bottom-left" => Some(4),
            "left-top" => Some(5),
            "right-top" => Some(6),
            "right-bottom" => Some(7),
            "left-bottom" => Some(8),
            _ => None,
        },
        _ => None,
    }
}

fn expect_prefixed_float(val: &Value) -> Option<f32> {
    match val {
        Value::String(ref str) => match f32::from_lexical_partial(str.as_bytes()) {
            Ok((val, _)) => Some(val),
            Err(_) => None,
        },
        Value::Number(ref num) => num.as_f64().map(|f| f as f32),
        _ => None,
    }
}

fn expect_float(val: &Value) -> Option<f32> {
    match val {
        Value::String(ref str) => match str.parse::<f32>() {
            Ok(val) => Some(val),
            Err(_) => None,
        },
        Value::Number(ref num) => num.as_f64().map(|f| f as f32),
        _ => None,
    }
}

fn expect_int(val: &Value) -> Option<i32> {
    match val {
        Value::String(ref str) => match str.parse::<i32>() {
            Ok(val) => Some(val),
            Err(_) => None,
        },
        Value::Number(ref num) => num.as_i64().map(|f| f as i32),
        _ => None,
    }
}

fn expect_shutter_speed(val: &Value) -> Option<f32> {
    match val {
        Value::Number(num) => num.as_f64().map(|f| f as f32),
        Value::String(str) => {
            if let Some(denominator) = str.strip_prefix("1/") {
                denominator.parse::<f32>().ok().map(|f| 1.0 / f)
            } else {
                str.parse::<f32>().ok()
            }
        }
        _ => None,
    }
}

#[allow(clippy::ptr_arg)]
fn pretty_make(name: String) -> Option<String> {
    Some(match name.as_str() {
        "NIKON CORPORATION" | "NIKON" => "Nikon".to_string(),
        "SAMSUNG" | "Samsung Techwin" => "Samsung".to_string(),
        "OLYMPUS IMAGING CORP." => "Olympus".to_string(),
        "EASTMAN KODAK COMPANY" => "Kodak".to_string(),
        "SONY" => "Sony".to_string(),
        _ => name,
    })
}

macro_rules! map {
    ($first:expr, $($others:expr),+ $(,)*) => {
        $first$(.and_then($others))+
    }
}

macro_rules! first_of {
    ($first:expr, $($others:expr),+ $(,)*) => {
        $first$(.or_else(|| $others))+
    }
}

impl ExifData {
    #[allow(clippy::field_reassign_with_default)]
    fn parse_exif_v1(exif: &Object, mimetype: &Mime) -> models::MediaMetadata {
        macro_rules! prop {
            ($prop:expr) => {
                exif.get($prop)
            };
        }

        let mut metadata = models::MediaMetadata::default();

        metadata.filename = map!(prop!("RawFileName"), expect_string);

        metadata.title = map!(prop!("Title"), expect_string);

        metadata.description = first_of!(
            map!(prop!("Description"), expect_string),
            map!(prop!("ImageDescription"), expect_string),
            map!(prop!("Caption-Abstract"), expect_string),
        );

        metadata.label = map!(prop!("Label"), expect_string);
        metadata.category = map!(prop!("Category"), expect_string);

        let nanos = first_of!(
            map!(prop!("SubSecTimeOriginal"), expect_subsecs),
            map!(prop!("SubSecTimeDigitized"), expect_subsecs),
        )
        .map(|ss| (ss * 1_000_000_000_f64) as u32)
        .or_else(|| {
            first_of!(
                map!(prop!("SubSecCreateDate"), expect_datetime),
                map!(prop!("SubSecDateTimeOriginal"), expect_datetime),
            )
            .map(|dt| dt.nanosecond())
        })
        .unwrap_or_default();

        metadata.taken = first_of!(
            map!(prop!("DateTimeOriginal"), expect_datetime),
            map!(prop!("DateCreated"), expect_datetime),
            map!(prop!("DateTimeCreated"), expect_datetime),
        )
        .map(|dt| dt.with_nanosecond(nanos).unwrap());

        metadata.latitude = map!(prop!("GPSLatitude"), expect_gps_coord);
        metadata.longitude = map!(prop!("GPSLongitude"), expect_gps_coord);
        metadata.altitude = map!(prop!("GPSAltitude"), expect_prefixed_float);

        metadata.location = first_of!(
            map!(prop!("Location"), expect_string),
            map!(prop!("Sub-location"), expect_string),
        );
        metadata.city = map!(prop!("City"), expect_string);
        metadata.state = first_of!(
            map!(prop!("State"), expect_string),
            map!(prop!("Province-State"), expect_string),
        );
        metadata.country = first_of!(
            map!(prop!("Country"), expect_string),
            map!(prop!("Country-PrimaryLocationName"), expect_string),
        );

        metadata.orientation = if mimetype.type_() == "image" {
            map!(prop!("Orientation"), expect_orientation)
        } else {
            Some(1)
        };

        metadata.make = first_of!(
            map!(prop!("Make"), expect_string, pretty_make),
            map!(prop!("AndroidManufacturer"), expect_string, pretty_make),
        );
        metadata.model = first_of!(
            map!(prop!("Model"), expect_string),
            map!(prop!("AndroidModel"), expect_string),
        );
        metadata.lens = first_of!(
            map!(prop!("Lens"), expect_string),
            map!(prop!("LensModel"), expect_string),
        );

        metadata.photographer = first_of!(
            map!(prop!("Creator"), expect_string_array),
            map!(prop!("Artist"), expect_string),
            map!(prop!("By-line"), expect_string),
        );

        metadata.aperture = first_of!(
            map!(prop!("FNumber"), expect_float),
            map!(prop!("ApertureValue"), expect_float),
        );
        metadata.shutter_speed = first_of!(
            map!(prop!("ExposureTime"), expect_shutter_speed),
            map!(prop!("ShutterSpeed"), expect_shutter_speed),
            map!(prop!("ShutterSpeedValue"), expect_shutter_speed),
        );
        metadata.iso = map!(prop!("ISO"), expect_int);
        metadata.focal_length = map!(prop!("FocalLength"), expect_prefixed_float);

        metadata.rating = first_of!(
            map!(prop!("RatingPercent"), expect_float).map(|p| (5.0 * p / 100.0).round() as i32),
            map!(prop!("Rating"), expect_int).map(|r| max(0, min(5, r)))
        );

        metadata
    }

    #[allow(clippy::field_reassign_with_default)]
    fn parse_exif_v2(exif: &Object, mimetype: &Mime) -> models::MediaMetadata {
        macro_rules! prop {
            ($prop:expr) => {
                exif.get($prop)
            };
            ($prop:expr, $($props:expr),+ $(,)*) => {
                exif.get($prop)
                    $(.and_then(expect_object).and_then(expect_prop($props)))+
            };
        }

        let mut metadata = models::MediaMetadata::default();

        metadata.filename = map!(prop!("XMP", "RawFileName"), expect_string);

        metadata.title = map!(prop!("XMP", "Title"), expect_string);

        metadata.description = first_of!(
            map!(prop!("XMP", "Description"), expect_string),
            map!(prop!("EXIF", "ImageDescription"), expect_string),
            map!(prop!("IPTC", "Caption-Abstract"), expect_string),
        );

        metadata.label = map!(prop!("XMP", "Label"), expect_string);
        metadata.category = map!(prop!("XMP", "Category"), expect_string);

        let nanos = first_of!(
            map!(prop!("EXIF", "SubSecTimeOriginal"), expect_subsecs),
            map!(prop!("EXIF", "SubSecTimeDigitized"), expect_subsecs),
        )
        .map(|ss| (ss * 1_000_000_000_f64) as u32)
        .or_else(|| {
            first_of!(
                map!(prop!("EXIF", "SubSecCreateDate"), expect_datetime),
                map!(prop!("EXIF", "SubSecDateTimeOriginal"), expect_datetime),
            )
            .map(|dt| dt.nanosecond())
        });

        metadata.taken = first_of!(
            map!(prop!("EXIF", "DateTimeOriginal"), expect_datetime),
            map!(prop!("XMP", "DateCreated"), expect_datetime),
            map!(prop!("Composite", "DateTimeCreated"), expect_datetime),
        )
        .map(|dt| {
            if let Some(nanos) = nanos {
                dt.with_nanosecond(nanos).unwrap_or(dt)
            } else {
                dt
            }
        });

        metadata.latitude = first_of!(
            map!(prop!("Composite", "GPSLatitude"), expect_gps_coord),
            map!(prop!("EXIF", "GPSLatitude"), expect_gps_coord).map(|coord| {
                fix_gps_sign(
                    coord,
                    map!(prop!("EXIF", "GPSLatitudeRef"), expect_string).unwrap_or_default(),
                )
            })
        );
        metadata.longitude = first_of!(
            map!(prop!("Composite", "GPSLongitude"), expect_gps_coord),
            map!(prop!("EXIF", "GPSLongitude"), expect_gps_coord).map(|coord| {
                fix_gps_sign(
                    coord,
                    map!(prop!("EXIF", "GPSLongitudeRef"), expect_string).unwrap_or_default(),
                )
            })
        );
        metadata.altitude = first_of!(
            map!(prop!("Composite", "GPSAltitude"), expect_gps_coord),
            map!(prop!("EXIF", "GPSAltitude"), expect_prefixed_float)
        );

        metadata.location = first_of!(
            map!(prop!("XMP", "Location"), expect_string),
            map!(prop!("IPTC", "Sub-location"), expect_string),
        );
        metadata.city = first_of!(
            map!(prop!("XMP", "City"), expect_string),
            map!(prop!("IPTC", "City"), expect_string),
        );
        metadata.state = first_of!(
            map!(prop!("XMP", "State"), expect_string),
            map!(prop!("IPTC", "Province-State"), expect_string),
        );
        metadata.country = first_of!(
            map!(prop!("XMP", "Country"), expect_string),
            map!(prop!("IPTC", "Country-PrimaryLocationName"), expect_string),
        );

        metadata.orientation = if mimetype.type_() == "image" {
            map!(prop!("XMP", "Orientation"), expect_orientation)
        } else {
            Some(1)
        };

        metadata.make = map!(prop!("EXIF", "Make"), expect_string, pretty_make);
        metadata.model = map!(prop!("EXIF", "Model"), expect_string);
        metadata.lens = first_of!(
            map!(prop!("XMP", "Lens"), expect_string),
            map!(prop!("EXIF", "LensModel"), expect_string),
        );

        metadata.photographer = first_of!(
            map!(prop!("XMP", "Creator"), expect_string_array),
            map!(prop!("EXIF", "Artist"), expect_string),
            map!(prop!("IPTC", "By-line"), expect_string),
        );

        metadata.aperture = first_of!(
            map!(prop!("EXIF", "FNumber"), expect_float),
            map!(prop!("EXIF", "ApertureValue"), expect_float),
        );
        metadata.shutter_speed = first_of!(
            map!(prop!("EXIF", "ExposureTime"), expect_float),
            map!(prop!("Composite", "ShutterSpeed"), expect_float),
            map!(prop!("EXIF", "ShutterSpeedValue"), expect_float),
        );
        metadata.iso = map!(prop!("EXIF", "ISO"), expect_int);
        metadata.focal_length = map!(prop!("EXIF", "FocalLength"), expect_float);

        metadata.rating = first_of!(
            map!(prop!("XMP", "Rating"), expect_int).map(|r| max(0, min(5, r))),
            map!(prop!("EXIF", "RatingPercent"), expect_float)
                .map(|p| (5.0 * p / 100.0).round() as i32),
        );
        metadata
    }

    pub(crate) fn media_metadata(&self, mimetype: &Mime) -> models::MediaMetadata {
        match self {
            ExifData::V1(ref obj) => ExifData::parse_exif_v1(obj, mimetype),
            ExifData::V2(ref obj) => ExifData::parse_exif_v2(obj, mimetype),
            ExifData::Unknown(_) => Default::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use serde_json::from_str;

    use super::ExifData;
    use crate::metadata::lookup_timezone;

    #[test]
    fn parse_exif() {
        let exif = from_str::<ExifData>(
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

        let metadata = exif.media_metadata(&mime::IMAGE_JPEG);
        assert_eq!(
            metadata.taken,
            Some(
                NaiveDate::from_ymd_opt(2013, 8, 29)
                    .unwrap()
                    .and_hms_milli_opt(17, 41, 6, 700)
                    .unwrap()
            )
        );
        assert_eq!(
            lookup_timezone(metadata.longitude.unwrap(), metadata.latitude.unwrap()).as_deref(),
            Some("Europe/Paris")
        );

        let exif = from_str::<ExifData>(
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

        let metadata = exif.media_metadata(&mime::IMAGE_JPEG);
        assert_eq!(
            metadata.taken,
            Some(
                NaiveDate::from_ymd_opt(2013, 8, 29)
                    .unwrap()
                    .and_hms_milli_opt(17, 42, 25, 600)
                    .unwrap()
            )
        );
        assert_eq!(
            lookup_timezone(metadata.longitude.unwrap(), metadata.latitude.unwrap()).as_deref(),
            Some("Europe/Paris")
        );

        let exif = from_str::<ExifData>(
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

        let metadata = exif.media_metadata(&mime::IMAGE_JPEG);
        assert_eq!(
            metadata.taken,
            Some(
                NaiveDate::from_ymd_opt(2023, 11, 1)
                    .unwrap()
                    .and_hms_milli_opt(17, 45, 39, 805)
                    .unwrap()
            )
        );
        assert_eq!(metadata.longitude, Some(-1.176903));
        assert_eq!(metadata.latitude, Some(52.747325));
        assert_eq!(
            lookup_timezone(metadata.longitude.unwrap(), metadata.latitude.unwrap()).as_deref(),
            Some("Europe/London")
        );

        let exif = from_str::<ExifData>(
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

        let metadata = exif.media_metadata(&mime::IMAGE_JPEG);
        assert_eq!(
            metadata.taken,
            Some(
                NaiveDate::from_ymd_opt(2023, 8, 9)
                    .unwrap()
                    .and_hms_micro_opt(12, 18, 56, 773958)
                    .unwrap()
            )
        );
        assert_eq!(
            lookup_timezone(metadata.longitude.unwrap(), metadata.latitude.unwrap()).as_deref(),
            Some("America/Los_Angeles")
        );
    }
}
