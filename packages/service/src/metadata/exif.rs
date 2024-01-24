use std::cmp::{max, min};

use chrono::{NaiveDateTime, Timelike};
use lexical_parse_float::FromLexical;
use serde_json::{Map, Value};
use tracing::warn;

use crate::store::models;

use super::ISO_FORMAT;

const TYPE_NULL: &str = "null";
const TYPE_BOOL: &str = "boolean";
const TYPE_NUMBER: &str = "number";
const TYPE_STRING: &str = "string";
const TYPE_ARRAY: &str = "array";
const TYPE_OBJECT: &str = "object";

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

pub(super) enum ExifVersion {
    V1(Object),
    V2(Object),
    Unknown,
}

impl From<Object> for ExifVersion {
    fn from(object: Object) -> ExifVersion {
        match object.get("ParseVersion") {
            Some(Value::Number(version)) => {
                if let Some(version) = version.as_u64() {
                    match version {
                        2 => ExifVersion::V2(object),
                        o => {
                            warn!("Unexpected parse version: {}", o);
                            ExifVersion::Unknown
                        }
                    }
                } else {
                    warn!(
                        "Expected parse version to be an integer got but {}",
                        version
                    );
                    ExifVersion::Unknown
                }
            }
            Some(val) => {
                warn!(
                    "Expected parse version to be a number got but {}",
                    type_of(val)
                );
                ExifVersion::Unknown
            }
            None => ExifVersion::V1(object),
        }
    }
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

#[allow(clippy::ptr_arg)]
fn pretty_make(name: String) -> String {
    match name.as_str() {
        "NIKON CORPORATION" | "NIKON" => "Nikon".to_string(),
        "SAMSUNG" | "Samsung Techwin" => "Samsung".to_string(),
        "OLYMPUS IMAGING CORP." => "Olympus".to_string(),
        "EASTMAN KODAK COMPANY" => "Kodak".to_string(),
        "SONY" => "Sony".to_string(),
        _ => name.clone(),
    }
}

macro_rules! map {
    ($first:expr, $($others:expr),+ $(,)*) => {
        $first$(.and_then($others))+
    }
}

macro_rules! first_of {
    ($first:expr, $($others:expr),+ $(,)*) => {
        $first$(.or($others))+
    }
}

impl ExifVersion {
    #[allow(clippy::field_reassign_with_default)]
    fn parse_exif_v1(exif: &Object, mimetype: &str) -> models::MediaMetadata {
        macro_rules! prop {
            ($prop:expr) => {
                exif.get($prop)
            };
        }

        let mut metadata = models::MediaMetadata::default();

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
            map!(prop!("DateTimeCreated"), expect_datetime),
            map!(prop!("DateTimeOriginal"), expect_datetime),
            map!(prop!("DateCreated"), expect_datetime),
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

        metadata.orientation = if mimetype.starts_with("image/") {
            map!(prop!("Orientation"), expect_orientation)
        } else {
            Some(1)
        };

        metadata.make = first_of!(
            map!(prop!("Make"), expect_string),
            map!(prop!("AndroidManufacturer"), expect_string),
        )
        .map(pretty_make);
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
            map!(prop!("ExposureTime"), expect_string),
            map!(prop!("ShutterSpeed"), expect_string),
            map!(prop!("ShutterSpeedValue"), expect_string),
        );
        metadata.iso = map!(prop!("ISO"), expect_int);
        metadata.focal_length = map!(prop!("FocalLength"), expect_prefixed_float);

        metadata.rating = first_of!(
            map!(prop!("RatingPercent"), expect_float).map(|p| (5.0 * p / 100.0).round() as i32),
            map!(prop!("Rating"), expect_int).map(|r| max(0, min(5, r)))
        );

        metadata
    }

    fn parse_exif_v2(exif: &Object, mimetype: &str) -> models::MediaMetadata {
        Default::default()
    }

    pub(super) fn media_metadata(&self, mimetype: &str) -> models::MediaMetadata {
        match self {
            ExifVersion::V1(ref obj) => ExifVersion::parse_exif_v1(obj, mimetype),
            ExifVersion::V2(ref obj) => ExifVersion::parse_exif_v2(obj, mimetype),
            ExifVersion::Unknown => Default::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use serde_json::from_str;

    use super::{ExifVersion, Object};
    use crate::metadata::lookup_timezone;

    #[test]
    fn parse_exif() {
        let exif = ExifVersion::from(
            from_str::<Object>(
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
            .unwrap(),
        );

        let metadata = exif.media_metadata("image/jpeg");
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

        let exif = ExifVersion::from(
            from_str::<Object>(
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
            .unwrap(),
        );

        let metadata = exif.media_metadata("image/jpeg");
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

        let exif = ExifVersion::from(
            from_str::<Object>(
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
            .unwrap(),
        );

        let metadata = exif.media_metadata("image/jpeg");
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

        let exif = ExifVersion::from(
            from_str::<Object>(
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
            .unwrap(),
        );

        let metadata = exif.media_metadata("image/jpeg");
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
