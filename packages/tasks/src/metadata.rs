use lazy_static::lazy_static;
use lexical_parse_float::FromLexical;
use pixelbin_store::models::MediaFile;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::{
    cmp::{max, min},
    str::FromStr,
};
use time::{
    format_description::{well_known::Iso8601, FormatItem},
    macros::format_description,
    OffsetDateTime, PrimitiveDateTime,
};
use tracing::warn;
use tzf_rs::DefaultFinder;

lazy_static! {
    static ref FINDER: DefaultFinder = DefaultFinder::new();
}

// exiftool -n -c '%+.6f' -json

pub(crate) const METADATA_FILE: &str = "metadata.json";
pub(crate) const PROCESS_VERSION: i32 = 4;

const EXIF_DATETIME_FORMAT: &[FormatItem<'_>] = format_description!(
    version = 2,
    "[year]:[month]:[day] [hour]:[minute][optional [:[second][optional [.[subsecond]]]]][optional [[offset_hour]:[offset_minute]]]"
);

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

pub(crate) fn deserialize_gps<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
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
) -> Result<Option<PrimitiveDateTime>, D::Error>
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

    if let Ok(dt) = PrimitiveDateTime::parse(&str, &Iso8601::DATE_TIME) {
        return Ok(Some(dt));
    }

    match PrimitiveDateTime::parse(&str, EXIF_DATETIME_FORMAT) {
        Ok(dt) => Ok(Some(dt)),
        Err(_) => {
            warn!(value = str, "Failed to deserialize datetime");
            Ok(None)
        }
    }
}

pub(crate) fn deserialize_orientation<'de, D>(deserializer: D) -> Result<Option<i32>, D::Error>
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

pub(crate) fn deserialize_subsecs<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
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

pub(crate) fn number_as_string<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
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
    #[serde(with = "pixelbin_shared::serde::datetime")]
    pub(crate) uploaded: OffsetDateTime,
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
            taken_zone: None,
            orientation: None,
            iso: None,
            rating: None,
            longitude: None,
            latitude: None,
            altitude: None,
            aperture: None,
            focal_length: None,
            taken: None,
            media: media_item.to_owned(),
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
                media_file.taken_zone = exif.parse_zone();

                media_file.longitude = exif.gps_longitude.map(|n| n as f32);
                media_file.latitude = exif.gps_latitude.map(|n| n as f32);
                media_file.altitude = exif.gps_altitude.map(|n| n as f32);

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
                        .cloned(),
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
    // pub(crate) create_date: Option<PrimitiveDateTime>,
    // #[serde(default, deserialize_with = "deserialize_offset")]
    // pub(crate) offset_time: Option<UtcOffset>,

    // Correct time, wrong (or no) timezone.
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) date_time_created: Option<PrimitiveDateTime>,
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) date_time_original: Option<PrimitiveDateTime>,
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) date_created: Option<PrimitiveDateTime>,
    // Only the time part.
    // #[serde(default, deserialize_with = "deserialize_time")]
    // pub(crate) time_created: Option<Time>,

    // The correct time using the timezone of the exporting device.
    // #[serde(default, deserialize_with = "deserialize_datetime")]
    // pub(crate) digital_creation_date_time: Option<PrimitiveDateTime>,
    // #[serde(default, deserialize_with = "deserialize_date")]
    // pub(crate) digital_creation_date: Option<Date>,
    // #[serde(default, deserialize_with = "deserialize_time")]
    // pub(crate) digital_creation_time: Option<Time>,

    // The correct time using the local time of the exporting device.
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) sub_sec_create_date: Option<PrimitiveDateTime>,
    #[serde(default, deserialize_with = "deserialize_datetime")]
    pub(crate) sub_sec_date_time_original: Option<PrimitiveDateTime>,

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
    #[serde(rename = "GPSAltitude")]
    pub(crate) gps_altitude: Option<f64>,

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
    pub(crate) fn parse_taken(&self) -> Option<PrimitiveDateTime> {
        let millis = self
            .sub_sec_time_original
            .or(self.sub_sec_time_digitized)
            .map(|ss| (ss * 1000000_f64) as u32)
            .or_else(|| {
                self.sub_sec_create_date
                    .or(self.sub_sec_date_time_original)
                    .map(|dt| dt.microsecond())
            })
            .unwrap_or_default();

        self.date_time_created
            .or(self.date_time_original)
            .or(self.date_created)
            .map(|dt| dt.replace_microsecond(millis).unwrap())
    }

    pub(crate) fn parse_zone(&self) -> Option<String> {
        match (self.gps_latitude, self.gps_longitude) {
            (Some(latitude), Some(longitude)) => {
                // NedTimezone::lookup(longitude, latitude).get(0).map(|tz| {
                //     tz.identifier
                //         .as_ref()
                //         .map(|i| i.to_string())
                //         .unwrap_or(tz.offset.to_string())
                // })

                Some(FINDER.get_tz_name(longitude, latitude).to_owned())
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::from_str;
    use time::macros::datetime;

    use super::Exif;

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
        assert_eq!(taken, datetime!(2013-08-29 17:41:06.70));
        assert_eq!(exif.parse_zone().as_deref(), Some("Europe/Paris"));

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
        assert_eq!(taken, datetime!(2013-08-29 17:42:25.60));
        assert_eq!(exif.parse_zone().as_deref(), Some("Europe/Paris"));

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
        assert_eq!(taken, datetime!(2023-11-01 17:45:39.805));
        assert_eq!(exif.gps_longitude, Some(-1.176903));
        assert_eq!(exif.gps_latitude, Some(52.747325));
        assert_eq!(exif.parse_zone().as_deref(), Some("Europe/London"));

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
        assert_eq!(exif.parse_zone().as_deref(), Some("America/Los_Angeles"));

        let taken = exif.parse_taken().unwrap();
        assert_eq!(taken, datetime!(2023-08-09 12:18:56.773958));
    }
}
