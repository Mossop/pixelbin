import { promises as fs } from "fs";

import sharp from "sharp";
import { file as tmpFile } from "tmp-promise";

import { upsert } from "../../utils";
import { extractFrame } from "../task-worker/ffmpeg";
import { quit } from "./events";
import Services from "./services";

interface LocalFile {
  id: string;
  media: string;
  mediaFile: string;
  original: string;
  originalMimetype: string;
  catalog: string;
  mimetype: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
}

async function buildImage(baseImage: Buffer): Promise<sharp.Sharp> {
  let base = sharp(baseImage);
  let { width, height, channels, icc } = await base.clone().metadata();

  if (!width || !height || !channels) {
    throw new Error("Unable to extract image metadata.");
  }

  let buffer = await base.raw().toBuffer();

  let imageSource = sharp(buffer, {
    raw: {
      width: width,
      height: height,
      channels: channels,
    },
  });

  if (icc) {
    let tmp = await tmpFile();
    await fs.writeFile(tmp.path, icc);
    imageSource = imageSource.withMetadata({
      // @ts-ignore: Outdated types.
      icc: tmp.path,
    });
  }

  return imageSource;
}

function bufferFromStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve: (buff: Buffer) => void, reject: (error: Error) => void) => {
    let chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

export default async function verifyLocal(): Promise<void> {
  console.log("Rebuilding local files...");
  let count = 0;
  let db = await Services.database;
  try {
    let localFiles = await db.knex.from("AlternateFile")
      .join("MediaFile", "MediaFile.id", "AlternateFile.mediaFile")
      .join("MediaInfo", "MediaInfo.mediaFile", "MediaFile.id")
      .where("AlternateFile.local", true)
      .orderBy("MediaInfo.catalog")
      .select<LocalFile[]>("AlternateFile.*", {
        media: "MediaInfo.id",
        original: "MediaFile.fileName",
        originalMimetype: "MediaFile.mimetype",
        catalog: "MediaInfo.catalog",
      });

    let catalogs = new Map<string, Map<string, LocalFile[]>>();
    for (let file of localFiles) {
      let mediaMap = upsert(catalogs, file.catalog, () => new Map<string, LocalFile[]>());

      let mediaFiles = upsert(mediaMap, file.media, (): LocalFile[] => []);
      mediaFiles.push(file);
    }

    let storageService = await Services.storage;

    for (let [catalog, mediaMap] of catalogs) {
      let storage = await storageService.getStorage(catalog);
      try {
        for (let [media, files] of mediaMap) {
          let filesToUpdate: LocalFile[] = [];

          for (let file of files) {
            let filename = await storage.get().getLocalFilePath(
              media,
              file.mediaFile,
              file.fileName,
            );

            try {
              let stat = await fs.stat(filename);
              if (!stat.isFile() || stat.size != file.fileSize) {
                filesToUpdate.push(file);
              }
            } catch (e) {
              filesToUpdate.push(file);
            }
          }

          if (filesToUpdate.length > 0) {
            try {
              console.log(
                `Pulling ${media} ${filesToUpdate[0].mediaFile} ${filesToUpdate[0].original}`,
              );

              let buffer = await bufferFromStream(await storage.get().streamFile(
                media,
                filesToUpdate[0].mediaFile,
                filesToUpdate[0].original,
              ));

              if (filesToUpdate[0].originalMimetype.startsWith("video/")) {
                let tmpSource = await tmpFile();
                await fs.writeFile(tmpSource.path, buffer);
                let tmpTarget = await tmpFile();

                await extractFrame(tmpSource.path, tmpTarget.path);
                buffer = await fs.readFile(tmpTarget.path);
              }

              let imageSource = await buildImage(buffer);
              for (let file of filesToUpdate) {
                try {
                  let size = Math.max(file.width, file.height);
                  let thumb = imageSource
                    .clone()
                    .resize(size, size, {
                      fit: "inside",
                    });

                  if (file.mimetype == "image/webp") {
                    thumb = thumb.webp({
                      quality: 70,
                      reductionEffort: 6,
                    });
                  } else if (file.mimetype == "image/jpeg") {
                    thumb = thumb.jpeg({
                      quality: 80,
                    });
                  }

                  let filename = await storage.get().getLocalFilePath(
                    media,
                    file.mediaFile,
                    file.fileName,
                  );
                  console.log(`Updating ${filename}`);

                  await thumb.toFile(filename);

                  let stat = await fs.stat(filename);
                  if (stat.size != file.fileSize) {
                    await db.knex.into("AlternateFile")
                      .where("AlternateFile.id", file.id)
                      .update({
                        fileSize: stat.size,
                      });
                    console.log("Updated DB.");
                  }

                  count++;
                } catch (e) {
                  console.error("Failed to rebuild.", file, e);
                }
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      } finally {
        storage.release();
      }
    }
    console.log(`Rebuilt ${count} local files.`);
  } finally {
    quit();
  }
}
