use std::{fs::File, io::BufWriter, path::Path, str::FromStr};

use file_format::FileFormat;
use image::{
    codecs::{
        jpeg::JpegEncoder,
        webp::{WebPEncoder, WebPQuality},
    },
    imageops::FilterType,
    io::Reader,
    DynamicImage,
};
use mime::Mime;
use tracing::{span, Instrument, Level};

use crate::{shared::spawn_blocking, Error, Result};

fn encode_image(
    mut source_image: DynamicImage,
    mime: &Mime,
    size: Option<i32>,
    temp: &Path,
) -> Result<(u32, u32)> {
    if let Some(size) = size {
        let _span = span!(
            Level::INFO,
            "image resize",
            "otel.name" = format!(
                "image resize ({}x{} -> {size})",
                source_image.width(),
                source_image.height()
            )
        )
        .entered();

        source_image = source_image.resize(size as u32, size as u32, FilterType::Lanczos3);
    }

    {
        let buffered = BufWriter::new(File::open(temp)?);

        let _span = span!(
            Level::INFO,
            "image encode",
            "otel.name" = format!("image encode ({mime})")
        )
        .entered();

        match mime.subtype().as_str() {
            "jpeg" => {
                let encoder = JpegEncoder::new_with_quality(buffered, 90);
                source_image.write_with_encoder(encoder)?;
            }
            "webp" => {
                #[allow(deprecated)]
                let encoder = WebPEncoder::new_with_quality(buffered, WebPQuality::lossy(80));
                source_image.write_with_encoder(encoder)?;
            }
            _ => return Err(Error::UnsupportedMedia { mime: mime.clone() }),
        }
    }

    Ok((source_image.width(), source_image.height()))
}

async fn encode_video(
    mime: &Mime,
    size: Option<i32>,
    target_path: &Path,
) -> Result<(Mime, i32, i32, Option<f32>, Option<f32>, Option<f32>)> {
    return Err(Error::UnsupportedMedia { mime: mime.clone() });

    load_video_data(target_path).await
}

pub(super) async fn encode_alternate(
    source_image: &DynamicImage,
    mime: &Mime,
    size: Option<i32>,
    target_path: &Path,
) -> Result<(Mime, i32, i32, Option<f32>, Option<f32>, Option<f32>)> {
    match mime.type_() {
        mime::IMAGE => {
            let source_image = source_image.clone();
            let image_path = target_path.to_owned();
            let image_mime = mime.clone();

            let (width, height) = spawn_blocking(
                span!(
                    Level::INFO,
                    "encode image",
                    "otel.name" = format!("encode image {mime}"),
                    "mimetype" = mime.as_ref(),
                ),
                move || encode_image(source_image, &image_mime, size, &image_path),
            )
            .await?;

            Ok((mime.clone(), width as i32, height as i32, None, None, None))
        }
        mime::VIDEO => {
            encode_video(mime, size, target_path)
                .instrument(span!(
                    Level::INFO,
                    "encode video",
                    "otel.name" = format!("encode video {mime}"),
                    "mimetype" = mime.as_ref(),
                ))
                .await
        }
        _ => Err(Error::UnsupportedMedia { mime: mime.clone() }),
    }
}

fn load_image(file_path: &Path) -> Result<DynamicImage> {
    let reader = Reader::open(file_path)?.with_guessed_format()?;

    Ok(reader.decode()?)
}

async fn load_video(file_path: &Path) -> Result<DynamicImage> {
    Err(Error::UnsupportedMedia {
        mime: mime::APPLICATION_OCTET_STREAM,
    })
}

pub(super) async fn load_source_image(file_path: &Path) -> Result<DynamicImage> {
    let format = FileFormat::from_file(file_path)?;
    let mime = Mime::from_str(format.media_type())?;

    match mime.type_() {
        mime::IMAGE => {
            let image_path = file_path.to_owned();
            spawn_blocking(
                span!(
                    Level::INFO,
                    "load image",
                    "otel.name" = format!("load image {mime}"),
                    "mimetype" = mime.as_ref(),
                ),
                move || load_image(&image_path),
            )
            .await
        }
        mime::VIDEO => {
            load_video(file_path)
                .instrument(span!(
                    Level::INFO,
                    "load video",
                    "otel.name" = format!("load video {mime}"),
                    "mimetype" = mime.as_ref(),
                ))
                .await
        }
        _ => Err(Error::UnsupportedMedia { mime: mime.clone() }),
    }
}

fn load_image_data(image_path: &Path) -> Result<(u32, u32)> {
    let img_reader = Reader::open(image_path)?.with_guessed_format()?;
    Ok(img_reader.into_dimensions()?)
}

async fn load_video_data(
    video_path: &Path,
) -> Result<(Mime, i32, i32, Option<f32>, Option<f32>, Option<f32>)> {
    Err(Error::UnsupportedMedia {
        mime: mime::APPLICATION_OCTET_STREAM,
    })
}

pub(super) async fn load_data(
    file_path: &Path,
) -> Result<(Mime, i32, i32, Option<f32>, Option<f32>, Option<f32>)> {
    let format = FileFormat::from_file(file_path)?;
    let mime = Mime::from_str(format.media_type())?;

    match mime.type_() {
        mime::IMAGE => {
            let image_path = file_path.to_owned();
            let (width, height) = spawn_blocking(
                span!(
                    Level::INFO,
                    "image decode",
                    "otel.name" = format!("image decode {mime}"),
                    "mimetype" = mime.as_ref(),
                ),
                move || load_image_data(&image_path),
            )
            .await?;
            Ok((mime, width as i32, height as i32, None, None, None))
        }
        mime::VIDEO => {
            load_video_data(file_path)
                .instrument(span!(
                    Level::INFO,
                    "video decode",
                    "otel.name" = format!("video decode {mime}"),
                    "mimetype" = mime.as_ref(),
                ))
                .await
        }
        _ => Err(Error::UnsupportedMedia { mime: mime.clone() }),
    }
}
