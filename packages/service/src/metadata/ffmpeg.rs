use std::{path::Path, str::FromStr};

use serde_json::{from_slice, Value};
use tokio::process::Command;
use tracing::instrument;

use crate::{
    metadata::media::{AudioCodec, Container, VideoCodec},
    shared::json::{
        expect_float, expect_int, expect_object_array, expect_string, first, map, prop, Object,
    },
    Error, Result,
};

trait ApplyArgs {
    fn add_video_args(&mut self, codec: VideoCodec) -> &mut Self;
    fn add_audio_args(&mut self, codec: AudioCodec) -> &mut Self;
    fn add_container_args(&mut self, container: Container) -> &mut Self;
}

impl ApplyArgs for Command {
    fn add_video_args(&mut self, codec: VideoCodec) -> &mut Self {
        match codec {
            VideoCodec::H264(crf) => self
                .arg("-c:v")
                .arg("libx264")
                .arg("-crf")
                .arg(crf.to_string()),
        }
    }

    fn add_audio_args(&mut self, codec: AudioCodec) -> &mut Self {
        match codec {
            AudioCodec::Aac(bitrate) => self
                .arg("-c:a")
                .arg("aac")
                .arg("-b:a")
                .arg(format!("{bitrate}k")),
        }
    }

    fn add_container_args(&mut self, container: Container) -> &mut Self {
        match container {
            Container::Mp4 => self.arg("-f").arg("mp4").arg("-movflags").arg("+faststart"),
        }
    }
}

pub(crate) async fn encode_video(
    local_file: &Path,
    container: Container,
    video_codec: VideoCodec,
    audio_codec: AudioCodec,
    target: &Path,
) -> Result {
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-loglevel")
        .arg("warning")
        .arg("-i")
        .arg(local_file)
        .add_video_args(video_codec)
        .add_audio_args(audio_codec)
        .add_container_args(container)
        .arg(target)
        .output()
        .await?;

    if !output.status.success() {
        return Err(Error::Unknown {
            message: format!(
                "Failed to execute ffmpeg: {}",
                std::str::from_utf8(&output.stderr).unwrap()
            ),
        });
    }

    Ok(())
}

#[instrument(skip_all)]
pub(crate) async fn extract_video_frame(local_file: &Path, target: &Path) -> Result {
    let output = Command::new("ffmpeg")
        .arg("-y")
        .arg("-loglevel")
        .arg("warning")
        .arg("-i")
        .arg(local_file)
        .arg("-frames:v")
        .arg("1")
        .arg("-q:v")
        .arg("3")
        .arg(target)
        .output()
        .await?;

    if !output.status.success() {
        return Err(Error::Unknown {
            message: format!(
                "Failed to execute ffmpeg: {}",
                std::str::from_utf8(&output.stderr).unwrap()
            ),
        });
    }

    Ok(())
}

pub(super) fn expect_frame_rate(val: &Value) -> Option<f32> {
    match val {
        Value::String(ref str) => {
            if let Some(pos) = str.find('/') {
                if let (Ok(num), Ok(den)) =
                    (f64::from_str(&str[0..pos]), f64::from_str(&str[pos + 1..]))
                {
                    if den != 0.0 {
                        return Some((num / den) as f32);
                    }
                }
            }

            str.parse::<f32>().ok()
        }
        Value::Number(ref num) => num.as_f64().map(|f| f as f32),
        _ => None,
    }
}

pub(crate) struct VideoData {
    pub(crate) width: i32,
    pub(crate) height: i32,
    pub(crate) duration: Option<f32>,
    pub(crate) bit_rate: Option<f32>,
    pub(crate) frame_rate: Option<f32>,
}

impl VideoData {
    fn parse(data: Object) -> Result<Self> {
        let video_stream = map!(prop!(data, "streams"), expect_object_array)
            .and_then(|o| {
                first(o, |obj| {
                    matches!(
                        map!(prop!(obj, "codec_type"), expect_string).as_deref(),
                        Some("video")
                    )
                })
            })
            .ok_or_else(|| Error::InvalidData {
                message: "Missing video stream".to_string(),
            })?;

        let width =
            map!(prop!(video_stream, "width"), expect_int).ok_or_else(|| Error::InvalidData {
                message: "Missing width".to_string(),
            })?;

        let height =
            map!(prop!(video_stream, "height"), expect_int).ok_or_else(|| Error::InvalidData {
                message: "Missing height".to_string(),
            })?;

        Ok(VideoData {
            width,
            height,
            frame_rate: map!(prop!(video_stream, "avg_frame_rate"), expect_frame_rate),
            duration: map!(prop!(data, "format", "duration"), expect_float),
            bit_rate: map!(prop!(data, "format", "bit_rate"), expect_float),
        })
    }

    #[instrument(skip_all)]
    pub(crate) async fn extract_video_data(local_file: &Path) -> Result<Self> {
        let output = Command::new("ffprobe")
            .arg("-hide_banner")
            .arg("-show_streams")
            .arg("-show_format")
            .arg("-output_format")
            .arg("json")
            .arg(local_file)
            .output()
            .await?;

        if !output.status.success() {
            return Err(Error::Unknown {
                message: format!(
                    "Failed to execute ffprobe: {}",
                    std::str::from_utf8(&output.stderr).unwrap()
                ),
            });
        }

        let data: Object = from_slice(&output.stdout)?;
        Self::parse(data)
    }
}

#[cfg(test)]
mod tests {
    use serde_json::from_str;

    use super::VideoData;
    use crate::shared::json::Object;

    #[test]
    fn parse_data() {
        let data = VideoData::parse(from_str::<Object>(
            r#"
{
  "streams": [
    {
      "index": 0,
      "codec_type": "data",
      "codec_tag_string": "mett",
      "codec_tag": "0x7474656d",
      "id": "0x1",
      "r_frame_rate": "0/0",
      "avg_frame_rate": "0/0",
      "time_base": "1/90000",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 1564466,
      "duration": "17.382956",
      "bit_rate": "57588",
      "nb_frames": "521",
      "disposition": {
        "default": 1,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0,
        "timed_thumbnails": 0,
        "non_diegetic": 0,
        "captions": 0,
        "descriptions": 0,
        "metadata": 0,
        "dependent": 0,
        "still_image": 0
      },
      "tags": {
        "creation_time": "2023-03-12T17:51:59.000000Z",
        "language": "eng",
        "handler_name": "MetaHandle"
      }
    },
    {
      "index": 1,
      "codec_name": "aac",
      "codec_long_name": "AAC (Advanced Audio Coding)",
      "profile": "LC",
      "codec_type": "audio",
      "codec_tag_string": "mp4a",
      "codec_tag": "0x6134706d",
      "sample_fmt": "fltp",
      "sample_rate": "48000",
      "channels": 2,
      "channel_layout": "stereo",
      "bits_per_sample": 0,
      "initial_padding": 0,
      "id": "0x2",
      "r_frame_rate": "0/0",
      "avg_frame_rate": "0/0",
      "time_base": "1/48000",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 833578,
      "duration": "17.366208",
      "bit_rate": "191842",
      "nb_frames": "813",
      "extradata_size": 2,
      "disposition": {
        "default": 1,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0,
        "timed_thumbnails": 0,
        "non_diegetic": 0,
        "captions": 0,
        "descriptions": 0,
        "metadata": 0,
        "dependent": 0,
        "still_image": 0
      },
      "tags": {
        "creation_time": "2023-03-12T17:51:59.000000Z",
        "language": "eng",
        "handler_name": "SoundHandle",
        "vendor_id": "[0][0][0][0]"
      }
    },
    {
      "index": 2,
      "codec_name": "hevc",
      "codec_long_name": "H.265 / HEVC (High Efficiency Video Coding)",
      "profile": "Main",
      "codec_type": "video",
      "codec_tag_string": "hvc1",
      "codec_tag": "0x31637668",
      "width": 1920,
      "height": 1080,
      "coded_width": 1920,
      "coded_height": 1088,
      "closed_captions": 0,
      "film_grain": 0,
      "has_b_frames": 0,
      "sample_aspect_ratio": "1:1",
      "display_aspect_ratio": "16:9",
      "pix_fmt": "yuvj420p",
      "level": 153,
      "color_range": "pc",
      "color_space": "bt709",
      "color_transfer": "bt709",
      "color_primaries": "bt709",
      "chroma_location": "left",
      "refs": 1,
      "id": "0x3",
      "r_frame_rate": "120/1",
      "avg_frame_rate": "23445000/782233",
      "time_base": "1/90000",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 1564466,
      "duration": "17.382956",
      "bit_rate": "20150391",
      "nb_frames": "521",
      "extradata_size": 107,
      "disposition": {
        "default": 1,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0,
        "timed_thumbnails": 0,
        "non_diegetic": 0,
        "captions": 0,
        "descriptions": 0,
        "metadata": 0,
        "dependent": 0,
        "still_image": 0
      },
      "tags": {
        "creation_time": "2023-03-12T17:51:59.000000Z",
        "language": "eng",
        "handler_name": "VideoHandle",
        "vendor_id": "[0][0][0][0]"
      },
      "side_data_list": [
        {
          "side_data_type": "Display Matrix",
          "displaymatrix": "\n00000000:            0       65536           0\n00000001:       -65536           0           0\n00000002:            0           0  1073741824\n",
          "rotation": -90
        }
      ]
    },
    {
      "index": 3,
      "codec_type": "data",
      "codec_tag_string": "mett",
      "codec_tag": "0x7474656d",
      "id": "0x4",
      "r_frame_rate": "0/0",
      "avg_frame_rate": "0/0",
      "time_base": "1/90000",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 1564466,
      "duration": "17.382956",
      "nb_frames": "1",
      "disposition": {
        "default": 1,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0,
        "timed_thumbnails": 0,
        "non_diegetic": 0,
        "captions": 0,
        "descriptions": 0,
        "metadata": 0,
        "dependent": 0,
        "still_image": 0
      },
      "tags": {
        "creation_time": "2023-03-12T17:51:59.000000Z",
        "language": "eng",
        "handler_name": "MetaHandle"
      }
    }
  ],
  "format": {
    "filename": "testing/data/pixelbin/data/temp/C:u09o3xAgif/M:gO76bvbcU2WlMYZlU2bRNRQME/I:PkvcgNBcmW/230312-175159.mp4",
    "nb_streams": 4,
    "nb_programs": 0,
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "format_long_name": "QuickTime / MOV",
    "start_time": "0.000000",
    "duration": "17.382956",
    "size": "44338642",
    "bit_rate": "20405570",
    "probe_score": 100,
    "tags": {
      "major_brand": "isom",
      "minor_version": "131072",
      "compatible_brands": "isomiso2mp41",
      "creation_time": "2023-03-12T17:51:59.000000Z",
      "location": "+52.7341-1.2014/",
      "location-eng": "+52.7341-1.2014/",
      "com.android.capture.fps": "30.000000"
    }
  }
}
            "#).unwrap()).unwrap();

        assert_eq!(data.width, 1920);
        assert_eq!(data.height, 1080);
        assert_eq!(data.duration, Some(17.382956));
        assert_eq!(data.bit_rate, Some(20405570.0));
        assert_eq!(data.frame_rate, Some(29.971888));

        let data = VideoData::parse(
            from_str::<Object>(
                r#"
{
  "streams": [
    {
      "index": 0,
      "codec_name": "aac",
      "codec_long_name": "AAC (Advanced Audio Coding)",
      "profile": "LC",
      "codec_type": "audio",
      "codec_tag_string": "mp4a",
      "codec_tag": "0x6134706d",
      "sample_fmt": "fltp",
      "sample_rate": "48000",
      "channels": 2,
      "channel_layout": "stereo",
      "bits_per_sample": 0,
      "initial_padding": 0,
      "id": "0x2",
      "r_frame_rate": "0/0",
      "avg_frame_rate": "0/0",
      "time_base": "1/48000",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 794000,
      "duration": "16.541667",
      "bit_rate": "252964",
      "nb_frames": "777",
      "extradata_size": 2,
      "disposition": {
        "default": 1,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0,
        "timed_thumbnails": 0,
        "non_diegetic": 0,
        "captions": 0,
        "descriptions": 0,
        "metadata": 0,
        "dependent": 0,
        "still_image": 0
      },
      "tags": {
        "creation_time": "2024-02-16T11:56:14.000000Z",
        "language": "eng",
        "handler_name": "Mainconcept MP4 Sound Media Handler",
        "vendor_id": "[0][0][0][0]"
      }
    },
    {
      "index": 1,
      "codec_name": "h264",
      "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
      "profile": "High",
      "codec_type": "video",
      "codec_tag_string": "avc1",
      "codec_tag": "0x31637661",
      "width": 960,
      "height": 540,
      "coded_width": 960,
      "coded_height": 540,
      "closed_captions": 0,
      "film_grain": 0,
      "has_b_frames": 1,
      "pix_fmt": "yuv420p",
      "level": 42,
      "color_range": "tv",
      "color_space": "smpte170m",
      "color_transfer": "smpte170m",
      "color_primaries": "smpte170m",
      "chroma_location": "left",
      "field_order": "progressive",
      "refs": 1,
      "is_avc": "true",
      "nal_length_size": "4",
      "id": "0x1",
      "r_frame_rate": "24/1",
      "avg_frame_rate": "24/1",
      "time_base": "1/24000",
      "start_pts": 0,
      "start_time": "0.000000",
      "duration_ts": 397000,
      "duration": "16.541667",
      "bit_rate": "11445423",
      "bits_per_raw_sample": "8",
      "nb_frames": "397",
      "extradata_size": 46,
      "disposition": {
        "default": 1,
        "dub": 0,
        "original": 0,
        "comment": 0,
        "lyrics": 0,
        "karaoke": 0,
        "forced": 0,
        "hearing_impaired": 0,
        "visual_impaired": 0,
        "clean_effects": 0,
        "attached_pic": 0,
        "timed_thumbnails": 0,
        "non_diegetic": 0,
        "captions": 0,
        "descriptions": 0,
        "metadata": 0,
        "dependent": 0,
        "still_image": 0
      },
      "tags": {
        "creation_time": "2024-02-16T11:56:14.000000Z",
        "language": "eng",
        "handler_name": "\u001fMainconcept Video Media Handler",
        "vendor_id": "[0][0][0][0]",
        "encoder": "AVC Coding"
      }
    }
  ],
  "format": {
    "filename": "/Users/dave/Desktop/230312-175159.mp4",
    "nb_streams": 2,
    "nb_programs": 0,
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "format_long_name": "QuickTime / MOV",
    "start_time": "0.000000",
    "duration": "16.541667",
    "size": "24251436",
    "bit_rate": "11728653",
    "probe_score": 100,
    "tags": {
      "major_brand": "mp42",
      "minor_version": "0",
      "compatible_brands": "mp42mp41",
      "creation_time": "2024-02-16T11:56:13.000000Z"
    }
  }
}
            "#,
            )
            .unwrap(),
        )
        .unwrap();

        assert_eq!(data.width, 960);
        assert_eq!(data.height, 540);
        assert_eq!(data.duration, Some(16.541667));
        assert_eq!(data.bit_rate, Some(11728653.0));
        assert_eq!(data.frame_rate, Some(24.0));
    }
}
