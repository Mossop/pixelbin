const { promises: fs } = require("fs");

const sharp = require("sharp");

const SOURCE = "/Users/dave/Desktop/201009-142150.jpg";

async function run() {
  let metadata = await sharp(SOURCE).metadata();
  if (metadata.icc) {
    await fs.writeFile("/Users/dave/Desktop/profile.icc", metadata.icc);
  }

  await sharp(SOURCE)
    .withMetadata()
    .webp({
      quality: 80,
      reductionEffort: 6,
    })
    .toFile("/Users/dave/Desktop/target.webp");

  await sharp(SOURCE)
    .webp({
      quality: 80,
      reductionEffort: 6,
    })
    .toFile("/Users/dave/Desktop/clean.webp");

  let buffer = await sharp(SOURCE).raw().toBuffer();

  let source = sharp(buffer, {
    raw: {
      width: metadata.width,
      height: metadata.height,
      channels: metadata.channels,
    },
  })
    .withMetadata({
      icc: metadata.icc ? "/Users/dave/Desktop/profile.icc" : undefined,
    });

  await source.clone().webp({
    quality: 80,
    reductionEffort: 6,
  })
    .toFile("/Users/dave/Desktop/test.webp");

  await source.clone().jpeg({
    quality: 90,
  })
    .toFile("/Users/dave/Desktop/test.jpg");
}

void run();
