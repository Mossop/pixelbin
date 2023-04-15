import { promises as fs } from "fs";
import path from "path";

import execa from "execa";
import ffprobe from "ffprobe-client";
import mp4box from "mp4box";
import { dir as tmpdir } from "tmp-promise";
import { JsonDecoder } from "ts.data.json";
import MIMEType from "whatwg-mimetype";

import { MappingDecoder, oneOf } from "../../utils";

const StringNumberDecoder = MappingDecoder(JsonDecoder.string, (value: string): number => {
  return parseFloat(value);
}, "number");

export enum Container {
  Unknown = "unknown",

  MP4 = "mp4",
  Ogg = "ogg",
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

const VideoCodecDecoder = JsonDecoder.oneOf([
  JsonDecoder.enumeration<VideoCodec>(VideoCodec, "VideoCodec"),
  JsonDecoder.constant(VideoCodec.Unknown),
], "VideoCodec");

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

const AudioCodecDecoder = JsonDecoder.oneOf([
  JsonDecoder.enumeration<AudioCodec>(AudioCodec, "AudioCodec"),
  JsonDecoder.constant(AudioCodec.Unknown),
], "AudioCodec");

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
  mimetype: string;
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

const ProbeFormatDecoder = JsonDecoder.object<Omit<Format, "mimetype">>({
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
  format: Omit<Format, "mimetype">;
}

const ProbeResultsDecoder = JsonDecoder.object<ProbeResults>({
  streams: JsonDecoder.array(StreamDecoder, "Stream[]"),
  format: ProbeFormatDecoder,
}, "ProbeResults");

export interface VideoInfo {
  format: Format;
  videoStream: Omit<VideoStream, "type"> | null;
  audioStream: Omit<AudioStream, "type"> | null;
}

async function mp4mimetype(file: string): Promise<string> {
  try {
    let buffer = new Uint8Array(await fs.readFile(file)).buffer;

    let info = await new Promise(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (resolve: (info: any) => void, reject: (error: Error) => void): void => {
        let mp4File = mp4box.createFile();
        mp4File.onReady = resolve;
        mp4File.onError = reject;
        buffer["fileStart"] = 0;
        mp4File.appendBuffer(buffer);
      },
    );

    if (info && "mime" in info) {
      let mime = info.mime;
      if (typeof mime == "string") {
        let fullType = new MIMEType(mime);
        let basicType = new MIMEType(fullType.essence);
        let codecs = fullType.parameters.get("codecs");
        if (codecs) {
          basicType.parameters.set("codecs", codecs);
        }

        return basicType.toString();
      }
    }
  } catch (e) {
    // Ignore errors.
  }

  return "video/mp4";
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

  let mimetype = `video/${results.format.container}`;
  const isNotUnknown = (stream: AudioStream | VideoStream): boolean => {
    return stream.codec != "unknown";
  };

  if (results.streams.every(isNotUnknown) && audio.every(isNotUnknown)) {
    switch (results.format.container) {
      case Container.WebM:
      case Container.Ogg: {
        let codecs = results.streams.map((stream: Stream): string => stream.codec);
        mimetype += `; codecs="${codecs.join(", ")}"`;
        break;
      }
      case Container.MP4:
        mimetype = await mp4mimetype(file);
    }
  }

  return {
    format: {
      ...results.format,
      mimetype,
    },
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
