import { promises as fs } from "fs";
import path from "path";

import { dir as tmpdir } from "tmp-promise";

import { probe, VideoCodec, AudioCodec, Container, encodeVideo } from "./ffmpeg";

const TEST_VIDEO = path.join(__dirname, "..", "..", "..", "testdata", "video.mp4");

test("probe", async (): Promise<void> => {
  let results = await probe(TEST_VIDEO);
  expect(results).toEqual({
    "format": {
      "container": "mp4",
      "bitRate": 18664868,
      "duration": 1.74,
    },
    "streams": [{
      "type": "video",
      "codec": "h264",
      "frameRate": 59.202207150247155,
      "width": 1920,
      "height": 1080,
    }, {
      "type": "audio",
      "codec": "aac",
    }],
  });
});

test("h264 encode", async (): Promise<void> => {
  let dir = await tmpdir({
    unsafeCleanup: true,
  });

  try {
    let original = await probe(TEST_VIDEO);

    let target = path.join(dir.path, "test.mp4");
    await encodeVideo(TEST_VIDEO, VideoCodec.H264, AudioCodec.AAC, Container.MP4, target);

    let stat = await fs.stat(target);
    expect(stat.isFile()).toBeTruthy();

    let results = await probe(target);
    expect(results).toEqual({
      "format": {
        "container": "mp4",
        "bitRate": expect.anything(),
        "duration": expect.anything(),
      },
      "streams": [{
        "type": "video",
        "codec": "h264",
        "frameRate": expect.anything(),
        "width": 1080,
        "height": 1920,
      }, {
        "type": "audio",
        "codec": "aac",
      }],
    });

    expect(results.format.bitRate).toBeLessThan(7000000);
    expect(results.format.bitRate).toBeGreaterThan(5000000);
    expect(results.format.duration).toBeCloseTo(original.format.duration, 1);
    // @ts-ignore: The check above ensures this is correct.
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    expect(results.streams[0].frameRate).toBeLessThan(original.streams[0].frameRate + 5);
    // @ts-ignore: The check above ensures this is correct.
    expect(results.streams[0].frameRate).toBeGreaterThan(original.streams[0].frameRate - 5);
  } finally {
    await dir.cleanup();
  }
}, 20000);
