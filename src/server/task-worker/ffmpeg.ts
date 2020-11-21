import path from "path";

import execa from "execa";
import ffprobe from "ffprobe-client";
import { dir as tmpdir } from "tmp-promise";
import { JsonDecoder } from "ts.data.json";

import { MappingDecoder, oneOf } from "../../utils";

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

const StreamDecoder = oneOf<Stream>([
  VideoStreamDecoder,
  AudioStreamDecoder,
], "Stream");

interface Format {
  duration: number;
  bitRate: number;
  container: Container;
  size: number;
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
  size: StringNumberDecoder,
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

export interface VideoInfo {
  format: Format;
  videoStream: Omit<VideoStream, "type"> | null;
  audioStream: Omit<AudioStream, "type"> | null;
}

export async function probe(file: string): Promise<VideoInfo> {
  let data = await ffprobe(file);
  let results = await ProbeResultsDecoder.decodePromise(data);
  let audio = results.streams.filter(
    (stream: Stream): stream is AudioStream => stream.type == "audio",
  );
  if (audio.length > 1) {
    throw new Error("Videos with multiple audio streams are not supported.");
  }
  let audioStream: Omit<AudioStream, "type"> | null = null;
  if (audio.length) {
    let { type, ...stream } = audio[0];
    audioStream = stream;
  }

  let video = results.streams.filter(
    (stream: Stream): stream is VideoStream => stream.type == "video",
  );
  if (video.length > 1) {
    throw new Error("Videos with multiple video streams are not supported.");
  }
  let videoStream: Omit<VideoStream, "type"> | null = null;
  if (video.length) {
    let { type, ...stream } = video[0];
    videoStream = stream;
  }

  return {
    format: results.format,
    videoStream,
    audioStream,
  };
}

export async function extractFrame(video: string, target: string): Promise<void> {
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
  ]);
  /* eslint-enable array-element-newline */
}

export async function encodeVideo(
  video: string,
  videoCodec: VideoCodec,
  audioCodec: AudioCodec,
  container: Container,
  target: string,
): Promise<VideoInfo> {
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
    ]);

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
    ]);
    /* eslint-enable array-element-newline */

    return probe(target);
  } finally {
    await dir.cleanup();
  }
}
