use std::{
    cmp,
    io::{BufWriter, ErrorKind},
    os::unix::fs::MetadataExt,
    path::Path,
    str::FromStr,
};

use chrono::{DateTime, LocalResult, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use exif::ExifData;
use image::{
    codecs::{
        jpeg::JpegEncoder,
        webp::{WebPEncoder, WebPQuality},
    },
    imageops::FilterType,
    io::Reader,
    DynamicImage,
};
use lazy_static::lazy_static;
use mime::Mime;
use serde::{Deserialize, Serialize};
use serde_json::from_str;
use tempfile::NamedTempFile;
use tokio::fs::{self, metadata, read_to_string};
use tracing::{error, info, instrument, warn};
use tzf_rs::DefaultFinder;

use crate::{
    shared::short_id,
    store::{
        db::DbConnection,
        models::{AlternateFile, AlternateFileType, MediaFile, MediaItem, Storage},
        path::{FilePath, MediaFilePath, ResourcePath},
    },
    Config, Error, FileStore, Result,
};

pub(crate) mod exif;

lazy_static! {
    static ref FINDER: DefaultFinder = DefaultFinder::new();
}

pub(crate) const METADATA_FILE: &str = "metadata.json";
pub(crate) const PROCESS_VERSION: i32 = 4;

pub(crate) const ISO_FORMAT: &str = "%Y-%m-%dT%H:%M:%S%.f";

pub(crate) const JPEG_EXTENSION: &str = "jpg";
pub(crate) const WEBP_EXTENSION: &str = "webp";

fn mime_extension(mimetype: &Mime) -> &'static str {
    match mimetype.essence_str() {
        "image/jpeg" => JPEG_EXTENSION,
        "image/webp" => WEBP_EXTENSION,
        _ => todo!(),
    }
}

pub(crate) struct Alternate {
    alt_type: AlternateFileType,
    mimetype: Mime,
    size: Option<i32>,
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

    pub(crate) async fn build<F: FileStore>(
        &self,
        conn: &mut DbConnection<'_>,
        media_file_path: &MediaFilePath,
        remote_store: &F,
        source_image: &DynamicImage,
    ) -> Result<AlternateFile> {
        let temp = NamedTempFile::new()?;
        let mut name = match self.alt_type {
            AlternateFileType::Thumbnail => "thumb".to_string(),
            AlternateFileType::Reencode => "reencode".to_string(),
        };

        let (width, height) = {
            let buffered = BufWriter::new(temp.reopen()?);

            if self.mimetype.type_() == "image" {
                let image = if let Some(size) = self.size {
                    name = format!("{name}-{size}");
                    source_image.resize(size as u32, size as u32, FilterType::Lanczos3)
                } else {
                    source_image.clone()
                };

                match self.mimetype.subtype().as_str() {
                    "jpeg" => {
                        let encoder = JpegEncoder::new_with_quality(buffered, 90);
                        image.write_with_encoder(encoder)?;
                    }
                    "webp" => {
                        let encoder =
                            WebPEncoder::new_with_quality(buffered, WebPQuality::lossy(80));
                        image.write_with_encoder(encoder)?;
                    }
                    _ => todo!(),
                }

                (image.width(), image.height())
            } else {
                todo!();
            }

            // Buffered file should close here.
        };

        let target_name = format!("{name}.{}", mime_extension(&self.mimetype));
        let stats = metadata(temp.path()).await?;

        let target = media_file_path.file(&target_name);
        match self.alt_type {
            AlternateFileType::Reencode => {
                remote_store
                    .push(temp.path(), &target, &self.mimetype)
                    .await?;
            }
            AlternateFileType::Thumbnail => {
                let local_store = conn.config().local_store();
                local_store.copy_from_temp(temp, &target).await?;
            }
        }

        Ok(AlternateFile {
            id: short_id("F"),
            file_type: self.alt_type,
            file_name: target_name,
            file_size: stats.size() as i32,
            mimetype: self.mimetype.clone(),
            width: width as i32,
            height: height as i32,
            duration: None,
            frame_rate: None,
            bit_rate: None,
            media_file: media_file_path.file.clone(),
            local: self.alt_type == AlternateFileType::Thumbnail,
        })
    }
}

pub(crate) fn alternates_for_mimetype(config: &Config, mimetype: &Mime) -> Vec<Alternate> {
    let mut alternates = Vec::new();

    for size in config.thumbnails.sizes.iter() {
        alternates.push(Alternate {
            alt_type: AlternateFileType::Thumbnail,
            mimetype: mime::IMAGE_JPEG,
            size: Some(*size as i32),
        });

        for alternate_mime in config.thumbnails.alternate_types.iter() {
            alternates.push(Alternate {
                alt_type: AlternateFileType::Thumbnail,
                mimetype: alternate_mime.clone(),
                size: Some(*size as i32),
            });
        }
    }

    alternates.push(Alternate {
        alt_type: AlternateFileType::Reencode,
        mimetype: mime::IMAGE_JPEG,
        size: None,
    });

    for alternate_mime in config.thumbnails.alternate_types.iter() {
        alternates.push(Alternate {
            alt_type: AlternateFileType::Reencode,
            mimetype: alternate_mime.clone(),
            size: None,
        });
    }

    if mimetype.type_() == "video" {
        alternates.push(Alternate {
            alt_type: AlternateFileType::Reencode,
            mimetype: Mime::from_str("video/mp4").unwrap(),
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
    pub(crate) file_size: i32,
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
    pub(crate) fn recover_media_file(&self, media_item: &str, id: &str) -> MediaFile {
        let mut media_file =
            MediaFile::new(media_item, &self.file_name, self.file_size, &self.mimetype);
        media_file.id = id.to_owned();
        media_file.process_version = 0;

        self.apply_to_media_file(&mut media_file);

        media_file
    }

    pub(crate) fn apply_to_media_file(&self, media_file: &mut MediaFile) {
        media_file.uploaded = self.uploaded;
        media_file.process_version = 0;
        media_file.file_name = self.file_name.clone();
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

pub(crate) async fn parse_metadata(metadata_file: &Path) -> Result<FileMetadata> {
    let str = read_to_string(metadata_file).await?;
    Ok(from_str::<FileMetadata>(&str)?)
}

async fn file_exists(path: &Path) -> Result<bool> {
    match metadata(path).await {
        Ok(m) => {
            if !m.is_file() {
                return Err(Error::UnexpectedPath {
                    path: path.display().to_string(),
                });
            }

            Ok(true)
        }
        Err(e) => {
            if e.kind() != ErrorKind::NotFound {
                return Err(Error::from(e));
            }

            Ok(false)
        }
    }
}

async fn ensure_local_copy<S: FileStore>(
    file_path: &FilePath,
    temp_path: &Path,
    remote_store: &S,
) -> Result {
    if !file_exists(temp_path).await? {
        remote_store.pull(file_path, temp_path).await?;
    }

    Ok(())
}

fn load_image(path: &Path) -> Result<DynamicImage> {
    let reader = Reader::open(path)?.with_guessed_format()?;
    Ok(reader.decode()?)
}

#[instrument(skip(conn, media_file, remote_store))]
pub(crate) async fn reprocess_media_file<S: FileStore>(
    conn: &mut DbConnection<'_>,
    media_file: &mut MediaFile,
    media_file_path: &MediaFilePath,
    remote_store: &S,
    build_alternates: bool,
) -> Result<bool> {
    let local_store = conn.config().local_store();
    let temp_store = conn.config().temp_store();
    let file_path = media_file_path.file(&media_file.file_name);
    let temp_path = temp_store.local_path(&file_path);

    let mut updated = false;

    if media_file.process_version != PROCESS_VERSION {
        if media_file.process_version == -1 {
            remote_store
                .push(&temp_path, &file_path, &media_file.mimetype)
                .await?;
            media_file.process_version = 0;
        }

        let metadata_path = local_store.local_path(&media_file_path.file(METADATA_FILE));

        let metadata = if file_exists(&metadata_path).await? {
            parse_metadata(&metadata_path).await?
        } else {
            ensure_local_copy(&file_path, &temp_path, remote_store).await?;

            let exif = ExifData::parse_media(&temp_path).await?;
            let img_reader = Reader::open(&temp_path)?.with_guessed_format()?;

            let mimetype = if let Some(format) = img_reader.format() {
                Mime::from_str(format.to_mime_type())?
            } else {
                return Err(Error::Unknown {
                    message: "Unknown image format".to_string(),
                });
            };

            let (width, height) = img_reader.into_dimensions()?;

            let stats = metadata(&temp_path).await?;

            let metadata = FileMetadata {
                exif,
                file_name: media_file.file_name.clone(),
                file_size: stats.len() as i32,
                width: width as i32,
                height: height as i32,
                uploaded: media_file.uploaded,
                mimetype,
                duration: None,
                bit_rate: None,
                frame_rate: None,
            };

            if let Some(parent) = metadata_path.parent() {
                fs::create_dir_all(parent).await?;
            }
            fs::write(&metadata_path, serde_json::to_string_pretty(&metadata)?).await?;

            metadata
        };

        metadata.apply_to_media_file(media_file);
        updated = true;
    }

    let alternates = AlternateFile::list_for_media_file(conn, &media_file.id).await?;
    let mut expected_alternates = alternates_for_mimetype(conn.config(), &media_file.mimetype);
    expected_alternates.retain(|alternate| !alternates.iter().any(|alt| alternate.matches(alt)));

    if !expected_alternates.is_empty() {
        media_file.process_version = 0;
        updated = true;

        if build_alternates {
            ensure_local_copy(&file_path, &temp_path, remote_store).await?;
            let source_image = load_image(&temp_path)?;

            let mut alternate_files = Vec::new();
            for alternate in expected_alternates {
                alternate_files.push(
                    alternate
                        .build(conn, media_file_path, remote_store, &source_image)
                        .await?,
                );
            }

            AlternateFile::upsert(conn, alternate_files).await?;

            media_file.process_version = PROCESS_VERSION;
        } else {
            // Leave temp files for the next reprocess.
            return Ok(true);
        }
    } else {
        media_file.process_version = PROCESS_VERSION;
    }

    temp_store
        .delete(&ResourcePath::MediaFile(media_file_path.clone()))
        .await?;

    Ok(updated)
}

#[instrument(skip_all)]
pub(crate) async fn reprocess_catalog_media(
    tx: &mut DbConnection<'_>,
    catalog: &str,
    build_alternates: bool,
) -> Result<()> {
    info!("Reprocessing media metadata");
    tx.assert_in_transaction();

    let current_files = MediaFile::list_newest(tx, catalog).await?;

    let mut media_files = Vec::new();
    let storage = Storage::get_for_catalog(tx, catalog).await?;

    let remote_store = storage.file_store().await?;

    for (mut media_file, media_file_path) in current_files {
        match reprocess_media_file(
            tx,
            &mut media_file,
            &media_file_path,
            &remote_store,
            build_alternates,
        )
        .await
        {
            Ok(true) => media_files.push(media_file),
            Ok(false) => {}
            Err(e) => {
                error!(path = %media_file_path, error = ?e, "Failed to process media metadata");
                media_files.push(media_file);
            }
        }
    }

    MediaFile::upsert(tx, media_files).await?;

    MediaItem::update_media_files(tx, catalog).await?;

    let mut media_items = MediaItem::list_unprocessed(tx, catalog).await?;
    for item in media_items.iter_mut() {
        item.sync_with_file(None);
    }

    MediaItem::upsert(tx, &media_items).await?;

    Ok(())
}
