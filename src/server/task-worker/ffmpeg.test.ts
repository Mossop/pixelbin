import { promises as fs } from "fs";
import path from "path";

import { dir as tmpdir } from "tmp-promise";

import { expect } from "../../test-helpers";
import { probe, VideoCodec, AudioCodec, Container, encodeVideo } from "./ffmpeg";

const TEST_VIDEO = path.join(__dirname, "..", "..", "..", "testdata", "video.mp4");

test("probe", async (): Promise<void> => {
  let results = await probe(TEST_VIDEO);
  expect(results).toEqual({
    format: {
      container: "mp4",
      bitRate: 18664868,
      duration: 1.74,
      size: 4059609,
    },
    videoStream: {
      codec: "h264",
      frameRate: 59.202207150247155,
      width: 1920,
      height: 1080,
    },
    audioStream: {
      codec: "aac",
    },
  });
});

test("h264 encode", async (): Promise<void> => {
  let dir = await tmpdir({
    unsafeCleanup: true,
  });

  try {
    let original = await probe(TEST_VIDEO);
    let videoStream = original.videoStream!;

    let target = path.join(dir.path, "test.mp4");
    let results = await encodeVideo(
      TEST_VIDEO,
      VideoCodec.H264,
      AudioCodec.AAC,
      Container.MP4,
      target,
    );

    let stat = await fs.stat(target);
    expect(stat.isFile()).toBeTruthy();

    expect(results).toEqual({
      format: {
        container: "mp4",
        bitRate: expect.toBeBetween(5000000, 7000000),
        duration: expect.anything(),
        size: expect.toBeBetween(1300000, 1600000),
      },
      videoStream: {
        codec: "h264",
        frameRate: expect.toBeBetween(videoStream.frameRate - 5, videoStream.frameRate + 5),
        width: 1080,
        height: 1920,
      },
      audioStream: {
        codec: "aac",
      },
    });

    expect(results.format.duration).toBeCloseTo(original.format.duration, 1);
  } finally {
    await dir.cleanup();
  }
}, 20000);
