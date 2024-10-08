use std::{
    fs::File,
    io::{BufWriter, Write},
    path::Path,
    str::FromStr,
};

use file_format::FileFormat;
use image::{
    codecs::{
        avif::{AvifEncoder, ColorSpace},
        jpeg::JpegEncoder,
    },
    imageops::FilterType,
    DynamicImage, ImageReader, RgbImage,
};
use mime::Mime;
use tracing::{span, Instrument, Level};
use webp::PixelLayout;

use crate::{
    metadata::ffmpeg::{extract_video_frame, VideoData},
    shared::spawn_blocking,
    store::models::AlternateFileType,
    Error, Result,
};

#[derive(Debug, Clone, Copy)]
pub(crate) enum Container {
    Mp4,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum VideoCodec {
    H264(u32),
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum AudioCodec {
    Aac(u32),
}

pub(crate) async fn resize_image(
    source_image: DynamicImage,
    width: i32,
    height: i32,
) -> DynamicImage {
    spawn_blocking(
        span!(
            Level::TRACE,
            "image resize",
            "source_width" = source_image.width(),
            "source_height" = source_image.height(),
            "target_width" = width,
            "target_height" = height,
        ),
        move || source_image.resize(width as u32, height as u32, FilterType::Lanczos3),
    )
    .await
}

pub(crate) async fn crop_image(
    source_image: DynamicImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> DynamicImage {
    spawn_blocking(
        span!(
            Level::TRACE,
            "image crop",
            "source_width" = source_image.width(),
            "source_height" = source_image.height(),
            "target_width" = width,
            "target_height" = height,
        ),
        move || source_image.crop_imm(x, y, width, height),
    )
    .await
}

fn encode_image(
    source_image: &DynamicImage,
    target_mime: &Mime,
    file_type: AlternateFileType,
    temp: &Path,
) -> Result {
    let mut buffered = BufWriter::new(File::create(temp)?);

    match target_mime.subtype().as_str() {
        "jpeg" => {
            let encoder = JpegEncoder::new_with_quality(buffered, 90);
            source_image.write_with_encoder(encoder)?;
        }
        "webp" => {
            let buffer = if let DynamicImage::ImageRgb8(image) = source_image {
                let encoder = webp::Encoder::new(
                    image.as_ref(),
                    PixelLayout::Rgb,
                    image.width(),
                    image.height(),
                );
                encoder.encode(80.0)
            } else {
                let image: RgbImage = source_image.clone().into();
                let encoder = webp::Encoder::new(
                    image.as_ref(),
                    PixelLayout::Rgb,
                    image.width(),
                    image.height(),
                );
                encoder.encode(80.0)
            };

            buffered.write_all(&buffer)?;
        }
        "avif" => {
            let (speed, quality) = match file_type {
                AlternateFileType::Thumbnail => (4, 80),
                _ => (4, 90),
            };
            let encoder = AvifEncoder::new_with_speed_quality(buffered, speed, quality)
                .with_colorspace(ColorSpace::Srgb);
            source_image.write_with_encoder(encoder)?;
        }
        _ => {
            return Err(Error::UnsupportedMedia {
                mime: target_mime.clone(),
            })
        }
    }

    Ok(())
}

async fn encode_video(
    source_path: &Path,
    target_mime: &Mime,
    target_path: &Path,
) -> Result<(Mime, i32, i32, Option<f32>, Option<f32>, Option<f32>)> {
    let (container, video, audio) = match target_mime.essence_str() {
        "video/mp4" => (Container::Mp4, VideoCodec::H264(26), AudioCodec::Aac(160)),
        st => {
            return Err(Error::InvalidData {
                message: format!("Unknown video codec: {st}"),
            })
        }
    };

    super::ffmpeg::encode_video(source_path, container, video, audio, target_path).await?;

    let format = FileFormat::from_file(target_path)?;
    let mime = Mime::from_str(format.media_type())?;
    let (width, height, duration, bit_rate, frame_rate) = load_video_data(target_path).await?;
    Ok((mime, width, height, duration, bit_rate, frame_rate))
}

pub(super) async fn encode_alternate_image(
    source_image: DynamicImage,
    mime: &Mime,
    file_type: AlternateFileType,
    target_path: &Path,
) -> Result {
    let image_path = target_path.to_owned();
    let image_mime = mime.clone();
    let width = source_image.width();
    let height = source_image.height();

    spawn_blocking(
        span!(
            Level::TRACE,
            "encode image",
            "mimetype" = mime.as_ref(),
            "source_width" = width,
            "source_height" = height,
        ),
        move || encode_image(&source_image, &image_mime, file_type, &image_path),
    )
    .await?;

    Ok(())
}

pub(super) async fn encode_alternate_video(
    source_path: &Path,
    mime: &Mime,
    target_path: &Path,
) -> Result<(Mime, i32, i32, Option<f32>, Option<f32>, Option<f32>)> {
    encode_video(source_path, mime, target_path)
        .instrument(span!(
            Level::TRACE,
            "encode video",
            "mimetype" = mime.as_ref(),
        ))
        .await
}

fn load_image(file_path: &Path) -> Result<DynamicImage> {
    let reader = ImageReader::open(file_path)?.with_guessed_format()?;

    Ok(reader.decode()?)
}

async fn load_video(file_path: &Path) -> Result<DynamicImage> {
    let mut temp_path = file_path.to_owned();
    temp_path.set_extension("jpg");
    extract_video_frame(file_path, &temp_path).await?;

    let format = FileFormat::from_file(file_path)?;
    let mime = Mime::from_str(format.media_type())?;

    spawn_blocking(
        span!(Level::TRACE, "load image", "mimetype" = mime.as_ref(),),
        move || load_image(&temp_path),
    )
    .await
}

pub(crate) async fn load_source_image(file_path: &Path) -> Result<DynamicImage> {
    let format = FileFormat::from_file(file_path)?;
    let mime = Mime::from_str(format.media_type())?;

    match mime.type_() {
        mime::IMAGE => {
            let image_path = file_path.to_owned();
            spawn_blocking(
                span!(Level::TRACE, "load image", "mimetype" = mime.as_ref(),),
                move || load_image(&image_path),
            )
            .await
        }
        mime::VIDEO => {
            load_video(file_path)
                .instrument(span!(
                    Level::TRACE,
                    "load video",
                    "mimetype" = mime.as_ref(),
                ))
                .await
        }
        _ => Err(Error::UnsupportedMedia { mime: mime.clone() }),
    }
}

fn load_image_data(image_path: &Path) -> Result<(u32, u32)> {
    let img_reader = ImageReader::open(image_path)?.with_guessed_format()?;
    Ok(img_reader.into_dimensions()?)
}

async fn load_video_data(
    video_path: &Path,
) -> Result<(i32, i32, Option<f32>, Option<f32>, Option<f32>)> {
    let video_data = VideoData::extract_video_data(video_path).await?;

    Ok((
        video_data.width,
        video_data.height,
        video_data.duration,
        video_data.bit_rate,
        video_data.frame_rate,
    ))
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
                span!(Level::TRACE, "image decode", "mimetype" = mime.as_ref(),),
                move || load_image_data(&image_path),
            )
            .await?;
            Ok((mime, width as i32, height as i32, None, None, None))
        }
        mime::VIDEO => {
            let (width, height, duration, bit_rate, frame_rate) = load_video_data(file_path)
                .instrument(span!(
                    Level::TRACE,
                    "video decode",
                    "mimetype" = mime.as_ref(),
                ))
                .await?;

            Ok((mime, width, height, duration, bit_rate, frame_rate))
        }
        _ => Err(Error::UnsupportedMedia { mime: mime.clone() }),
    }
}
