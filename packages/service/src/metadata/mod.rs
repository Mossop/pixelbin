use std::{cmp, os::unix::fs::MetadataExt, path::Path, str::FromStr};

use chrono::{DateTime, LocalResult, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use exif::ExifData;
use image::DynamicImage;
use lazy_static::lazy_static;
pub(crate) use media::{load_source_image, resize_image};
use mime::Mime;
use serde::{Deserialize, Serialize};
use serde_json::from_str;
use tempfile::{NamedTempFile, TempPath};
use tokio::fs::{metadata, read_to_string};
use tracing::{instrument, warn};
use tzf_rs::DefaultFinder;

use crate::{
    store::models::{AlternateFile, AlternateFileType, MediaFile, MediaItem},
    Config, Error, Result,
};

pub(crate) mod exif;
mod ffmpeg;
mod media;

lazy_static! {
    static ref FINDER: DefaultFinder = DefaultFinder::new();
}

pub(crate) const METADATA_FILE: &str = "metadata.json";

pub(crate) const ISO_FORMAT: &str = "%Y-%m-%dT%H:%M:%S%.f";

pub(crate) const JPEG_EXTENSION: &str = "jpg";
pub(crate) const WEBP_EXTENSION: &str = "webp";
pub(crate) const AVIF_EXTENSION: &str = "avif";
pub(crate) const MP4_EXTENSION: &str = "mp4";

fn mime_extension(mimetype: &Mime) -> &'static str {
    match mimetype.essence_str() {
        "image/jpeg" => JPEG_EXTENSION,
        "image/webp" => WEBP_EXTENSION,
        "image/avif" => AVIF_EXTENSION,
        "video/mp4" => MP4_EXTENSION,
        st => panic!("Unexpected mimetype {st}"),
    }
}

#[derive(Debug)]
pub(crate) struct Alternate {
    pub(crate) file_name: String,
    pub(crate) alt_type: AlternateFileType,
    pub(crate) mimetype: Mime,
    pub(crate) size: Option<i32>,
}

impl Alternate {
    pub(crate) fn matches(&self, alt: &AlternateFile) -> bool {
        if alt.file_type != self.alt_type {
            return false;
        }

        if let Some(size) = self.size {
            if cmp::max(alt.width, alt.height) != size {
                return false;
            }
        }

        self.mimetype == alt.mimetype
    }
}

pub(crate) async fn encode_alternate_image(
    alternate_file: &mut AlternateFile,
    source_image: &DynamicImage,
) -> Result<TempPath> {
    let temp = NamedTempFile::new()?.into_temp_path();

    media::encode_alternate_image(
        source_image.clone(),
        &alternate_file.mimetype,
        alternate_file.file_type,
        &temp,
    )
    .await?;

    let stats = metadata(&temp).await?;

    alternate_file.file_size = stats.size() as i64;
    alternate_file.width = source_image.width() as i32;
    alternate_file.height = source_image.height() as i32;
    alternate_file.duration = None;
    alternate_file.frame_rate = None;
    alternate_file.bit_rate = None;

    Ok(temp)
}

pub(crate) async fn encode_alternate_video(
    source_path: &Path,
    alternate_file: &mut AlternateFile,
) -> Result<TempPath> {
    let temp = NamedTempFile::new()?.into_temp_path();

    let (mimetype, width, height, duration, frame_rate, bit_rate) =
        media::encode_alternate_video(source_path, &alternate_file.mimetype, &temp).await?;

    let stats = metadata(&temp).await?;

    alternate_file.mimetype = mimetype;
    alternate_file.file_size = stats.size() as i64;
    alternate_file.width = width;
    alternate_file.height = height;
    alternate_file.duration = duration;
    alternate_file.frame_rate = frame_rate;
    alternate_file.bit_rate = bit_rate;

    Ok(temp)
}

pub(crate) fn alternates_for_media_file(
    config: &Config,
    media_file: &MediaFile,
    _is_public: bool,
) -> Vec<Alternate> {
    let base_name = if let Some(idx) = media_file.file_name.rfind('.') {
        media_file.file_name[0..idx].to_owned()
    } else {
        media_file.file_name.clone()
    };

    let mut alternates = Vec::new();

    let jpg_extension = mime_extension(&mime::IMAGE_JPEG);

    for size in config.thumbnails.sizes.iter() {
        alternates.push(Alternate {
            file_name: format!("{base_name}-{size}.{jpg_extension}"),
            alt_type: AlternateFileType::Thumbnail,
            mimetype: mime::IMAGE_JPEG,
            size: Some(*size as i32),
        });

        for alternate_mime in config.thumbnails.alternate_types.iter() {
            alternates.push(Alternate {
                file_name: format!("{base_name}-{size}.{}", mime_extension(alternate_mime)),
                alt_type: AlternateFileType::Thumbnail,
                mimetype: alternate_mime.clone(),
                size: Some(*size as i32),
            });
        }
    }

    alternates.push(Alternate {
        file_name: format!("{base_name}-{jpg_extension}.{jpg_extension}"),
        alt_type: AlternateFileType::Reencode,
        mimetype: mime::IMAGE_JPEG,
        size: None,
    });

    for alternate_mime in config.thumbnails.alternate_types.iter() {
        let extension = mime_extension(alternate_mime);
        alternates.push(Alternate {
            file_name: format!("{base_name}-{extension}.{extension}"),
            alt_type: AlternateFileType::Reencode,
            mimetype: alternate_mime.clone(),
            size: None,
        });
    }

    if media_file.mimetype.type_() == "video" {
        let mimetype = Mime::from_str("video/mp4").unwrap();
        let extension = mime_extension(&mimetype);
        alternates.push(Alternate {
            file_name: format!("{base_name}-h264.{extension}"),
            alt_type: AlternateFileType::Reencode,
            mimetype,
            size: None,
        })
    }

    alternates
}

pub(crate) fn lookup_timezone(longitude: f32, latitude: f32) -> Option<String> {
    Some(
        FINDER
            .get_tz_name(longitude as f64, latitude as f64)
            .to_owned(),
    )
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
    let taken = media_item
        .metadata
        .taken
        .or(media_file.and_then(|f| f.metadata.taken));
    let taken_zone = &media_item.taken_zone;
    if let Some(dt) = time_from_taken(taken, taken_zone) {
        dt
    } else {
        media_item.created
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileMetadata {
    pub(crate) exif: ExifData,
    pub(crate) file_name: String,
    pub(crate) file_size: i64,
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) uploaded: DateTime<Utc>,
    #[serde(with = "crate::shared::mime")]
    pub(crate) mimetype: Mime,
    pub(crate) duration: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
}

impl FileMetadata {
    // pub(crate) fn recover_media_file(&self, media_item: &str, id: &str) -> MediaFile {
    //     let mut media_file =
    //         MediaFile::new(media_item, &self.file_name, self.file_size, &self.mimetype);
    //     media_file.id = id.to_owned();
    //     media_file.needs_metadata = true;

    //     self.apply_to_media_file(&mut media_file);

    //     media_file
    // }

    pub(crate) fn apply_to_media_file(&self, media_file: &mut MediaFile) {
        media_file.uploaded = self.uploaded;
        media_file.needs_metadata = false;
        media_file.file_name.clone_from(&self.file_name);
        media_file.file_size = self.file_size;
        media_file.mimetype = self.mimetype.clone();

        media_file.width = self.width;
        media_file.height = self.height;
        media_file.duration = self.duration;
        media_file.frame_rate = self.frame_rate;
        media_file.bit_rate = self.bit_rate;
        media_file.metadata = self.exif.media_metadata(&self.mimetype);
    }
}

#[instrument(level = "trace")]
pub(crate) async fn parse_metadata(metadata_file: &Path) -> Result<FileMetadata> {
    let str = read_to_string(metadata_file).await?;
    Ok(from_str::<FileMetadata>(&str)?)
}

#[instrument(level = "trace")]
pub(crate) async fn parse_media(media_file: &Path) -> Result<FileMetadata> {
    let exif = ExifData::extract_exif_data(media_file).await?;

    let stats = metadata(&media_file).await?;

    let (mimetype, width, height, duration, bit_rate, frame_rate) =
        media::load_data(media_file).await?;

    let file_name = media_file
        .file_name()
        .and_then(|os| os.to_str())
        .ok_or_else(|| Error::UnexpectedPath {
            path: media_file.display().to_string(),
        })?;

    Ok(FileMetadata {
        exif,
        file_name: file_name.to_owned(),
        file_size: stats.len() as i64,
        width,
        height,
        uploaded: Utc::now(),
        mimetype,
        duration,
        bit_rate,
        frame_rate,
    })
}
