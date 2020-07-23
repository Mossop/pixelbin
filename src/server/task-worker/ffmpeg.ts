
import ffprobe from "ffprobe-client";
import { JsonDecoder } from "ts.data.json";

import { MediaInfo } from "../../model/models";
import { MappingDecoder } from "../../utils";

const StringNumberDecoder = MappingDecoder(JsonDecoder.string, (value: string): number => {
  return parseFloat(value);
}, "number");

interface VideoStream {
  type: "video";
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

const VideoStreamDecoder = JsonDecoder.object<VideoStream>({
  type: JsonDecoder.isExactly("video"),
  width: JsonDecoder.number,
  height: JsonDecoder.number,
  frameRate: FrameRateDecoder,
}, "VideoStream", {
  type: "codec_type",
  frameRate: "avg_frame_rate",
});

interface AudioStream {
  type: "audio";
}

const AudioStreamDecoder = JsonDecoder.object<AudioStream>({
  type: JsonDecoder.isExactly("audio"),
}, "AudioStream", {
  type: "codec_type",
});

type Stream = AudioStream | VideoStream;

function isVideoStream(stream: Stream): stream is VideoStream {
  return stream.type == "video";
}

const StreamDecoder = JsonDecoder.oneOf<Stream>([
  VideoStreamDecoder,
  AudioStreamDecoder,
], "Stream");

interface Format {
  duration: number;
  bitRate: number;
}

const FormatDecoder = JsonDecoder.object<Format>({
  duration: StringNumberDecoder,
  bitRate: StringNumberDecoder,
}, "Format", {
  bitRate: "bit_rate",
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

export async function probe(file: string): Promise<VideoInfo> {
  let data = await ffprobe(file);
  let decoded = await ProbeResultsDecoder.decodePromise(data);

  let videoStreams = decoded.streams.filter(isVideoStream);
  if (!videoStreams.length) {
    throw new Error("Video includes no video streams.");
  }

  return {
    width: videoStreams[0].width,
    height: videoStreams[0].height,
    duration: decoded.format.duration,
    bitRate: decoded.format.bitRate,
    frameRate: videoStreams[0].frameRate,
  };
}
