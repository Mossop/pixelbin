import path from "path";

import execa, { ExecaError } from "execa";
import ffprobe from "ffprobe-client";
import { dir as tmpdir } from "tmp-promise";
import { JsonDecoder } from "ts.data.json";

import { MediaInfo } from "../../model/models";
import { MappingDecoder } from "../../utils";

const StringNumberDecoder = MappingDecoder(JsonDecoder.string, (value: string): number => {
  return parseFloat(value);
}, "number");

export enum Container {
  Unknown = "unknown",

  MP4 = "mp4",
  WebM = "webm",
  Matroska = "mkv",
}

export enum VideoCodec {
  Unknown = "unknown",

  H264 = "h264",
  VP9 = "vp9",
  VP8 = "vp8",
  AV1 = "av1",
}

export enum AudioCodec {
  Unknown = "unknown",
  Copy = "copy",

  AAC = "aac",
  Opus = "opus",
  Vorbis = "vorbis",
}

/* eslint-disable array-element-newline */
const FFMPEG_ARGS = {
  [VideoCodec.H264]: ["-c:v", "libx264", "-b:v", "6M"],
  [VideoCodec.VP9]: ["-c:v", "libvpx-vp9", "-b:v", "4M"],
  [VideoCodec.AV1]: ["-c:v", "libaom-av1", "-strict", "experimental", "-b:v", "2M"],

  [AudioCodec.AAC]: ["-c:a", "aac", "-b:a", "160k"],
  [AudioCodec.Opus]: ["-c:a", "libopus", "-b:a", "100k"],
  [AudioCodec.Copy]: ["-c:a", "copy"],

  [Container.MP4]: ["-f", "mp4", "-movflags", "+faststart"],
  [Container.WebM]: ["-f", "webm"],
};
/* eslint-enable array-element-newline */

export interface VideoStream {
  type: "video";
  codec: VideoCodec;
  width: number;
  height: number;
  frameRate: number;
}

const FRAME_RATE_REGEX = /^(\d+)\/(\d+)$/;
const FrameRateDecoder = MappingDecoder(JsonDecoder.string, (value: string): number => {
  let results = FRAME_RATE_REGEX.exec(value);
  if (results) {
    return parseInt(results[1]) / parseInt(results[2]);
  } else {
    throw new Error(`Frame rate did not match the expected format: ${value}`);
  }
}, "frameRate");

function EnumDecoder<T>(en: Record<string, string>, type: string): JsonDecoder.Decoder<T> {
  return MappingDecoder(JsonDecoder.string, (value: string): T => {
    for (let val of Object.values(en)) {
      if (val == value) {
        return value as unknown as T;
      }
    }

    throw new Error(`${value} is not a valid ${type}.`);
  }, type);
}

const VideoCodecDecoder = EnumDecoder<VideoCodec>(VideoCodec, "VideoCodec");

const VideoStreamDecoder = JsonDecoder.object<VideoStream>({
  type: JsonDecoder.isExactly("video"),
  codec: VideoCodecDecoder,
  width: JsonDecoder.number,
  height: JsonDecoder.number,
  frameRate: FrameRateDecoder,
}, "VideoStream", {
  type: "codec_type",
  codec: "codec_name",
  frameRate: "avg_frame_rate",
});

const AudioCodecDecoder = EnumDecoder<AudioCodec>(AudioCodec, "AudioCodec");

export interface AudioStream {
  type: "audio";
  codec: AudioCodec;
}

const AudioStreamDecoder = JsonDecoder.object<AudioStream>({
  type: JsonDecoder.isExactly("audio"),
  codec: AudioCodecDecoder,
}, "AudioStream", {
  type: "codec_type",
  codec: "codec_name",
});

export type Stream = AudioStream | VideoStream;

const StreamDecoder = JsonDecoder.oneOf<Stream>([
  VideoStreamDecoder,
  AudioStreamDecoder,
], "Stream");

interface Format {
  duration: number;
  bitRate: number;
  container: Container
}

const ContainerDecoder = MappingDecoder(JsonDecoder.string, (value: string): Container => {
  if (value.includes("matroska")) {
    return Container.Matroska;
  }

  if (value.includes("webm")) {
    return Container.WebM;
  }

  if (value.includes("mp4")) {
    return Container.MP4;
  }

  return Container.Unknown;
}, "Container");

const FormatDecoder = JsonDecoder.object<Format>({
  duration: StringNumberDecoder,
  bitRate: StringNumberDecoder,
  container: ContainerDecoder,
}, "Format", {
  bitRate: "bit_rate",
  container: "format_name",
});

interface ProbeResults {
  streams: Stream[];
  format: Format;
}

const ProbeResultsDecoder = JsonDecoder.object<ProbeResults>({
  streams: JsonDecoder.array(StreamDecoder, "Stream[]"),
  format: FormatDecoder,
}, "ProbeResults");

type VideoInfo =
  Omit<MediaInfo, "id" | "media" | "uploaded" | "fileSize" | "mimetype" | "hostedName">;

export async function probe(file: string): Promise<ProbeResults> {
  let data = await ffprobe(file);
  return ProbeResultsDecoder.decodePromise(data);
}

export async function extractFrame(video: string, target: string): Promise<void> {
  try {
    /* eslint-disable array-element-newline */
    await execa("ffmpeg", [
      "-y",
      "-loglevel", "warning",
      "-i", video,
      "-frames:v", "1",
      "-q:v", "3",
      "-f", "singlejpeg",
      "-y",
      target,
    ], {
      all: true,
    });
    /* eslint-enable array-element-newline */
  } catch (e) {
    let error: ExecaError = e;
    throw error.all;
  }
}

export async function encodeVideo(
  video: string,
  videoCodec: VideoCodec,
  audioCodec: AudioCodec,
  container: Container,
  target: string,
): Promise<void> {
  let dir = await tmpdir({
    unsafeCleanup: true,
  });

  try {
    /* eslint-disable array-element-newline */
    await execa("ffmpeg", [
      "-y",
      "-loglevel", "warning",
      "-i", video,
      ...FFMPEG_ARGS[videoCodec],
      "-pass", "1",
      "-passlogfile", path.join(dir.path, "ffmpeglog"),
      "-an",
      ...FFMPEG_ARGS[container],
      "/dev/null",
    ], {
      all: true,
    });

    await execa("ffmpeg", [
      "-y",
      "-loglevel", "warning",
      "-i", video,
      ...FFMPEG_ARGS[videoCodec],
      "-pass", "2",
      "-passlogfile", path.join(dir.path, "ffmpeglog"),
      ...FFMPEG_ARGS[audioCodec],
      ...FFMPEG_ARGS[container],
      target,
    ], {
      all: true,
    });
    /* eslint-enable array-element-newline */
  } catch (e) {
    let error: ExecaError = e;
    throw error.all;
  } finally {
    await dir.cleanup();
  }
}
