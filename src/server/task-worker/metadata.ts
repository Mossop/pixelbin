import { promises as fs } from "fs";

import type { Tags } from "exiftool-vendored";
import { ExifDate, ExifDateTime, ExifTime } from "exiftool-vendored";
import { extension as mimeExtension } from "mime-types";
import { Magic, MAGIC_MIME_TYPE } from "mmmagic";
import sharp from "sharp";

import type { ObjectModel } from "../../model";
import type {
  DateTime,
  Nullable,
} from "../../utils";
import {
  dateTimeFromMillis,
  entries,
  parseDateTime,
} from "../../utils";
import type { StoredFile } from "../storage";
import { probe } from "./ffmpeg";
import Services from "./services";

type ExcludedTags =
  "FileAccessDate" | "FileInodeChangeDate" | "FileModifyDate" | "FilePermissions" | "Directory" |
  "SourceFile";
const BadTags: ExcludedTags[] = [
  "FileAccessDate",
  "FileInodeChangeDate",
  "FileModifyDate",
  "FilePermissions",
  "Directory",
  "SourceFile",
];

type StoredTag<T> =
  T extends ExifDate | ExifDateTime | ExifTime ? string : T;

type ExifTags = { [K in keyof Omit<Tags, ExcludedTags>]?: StoredTag<Tags[K]>; };

export type StoredData = ObjectModel.FileInfo & {
  exif: ExifTags;
  uploaded: DateTime;
};

type MetadataParser<T> = (data: StoredData) => T | null;

type MetadataParsers = {
  [K in keyof ObjectModel.Metadata]: MetadataParser<ObjectModel.Metadata[K]>[];
};

function straight<K extends keyof ExifTags>(key: K): MetadataParser<NonNullable<ExifTags[K]>> {
  return (data: StoredData): NonNullable<ExifTags[K]> | null => {
    if (data.exif[key] === undefined) {
      return null;
    }

    // @ts-ignore
    return data.exif[key];
  };
}

function forced<T>(key: string): MetadataParser<T> {
  return (data: StoredData): T | null => {
    if (data.exif[key] === undefined) {
      return null;
    }

    return data.exif[key] as T;
  };
}

function joined(inner: MetadataParser<string[]>): MetadataParser<string> {
  return (data: StoredData): string | null => {
    let strs = inner(data);
    if (!strs || strs.length == 0) {
      return null;
    }

    return strs.join(", ");
  };
}

function float(inner: MetadataParser<string>): MetadataParser<number> {
  return (data: StoredData): number | null => {
    let str = inner(data);
    if (!str) {
      return null;
    }

    return parseFloat(str);
  };
}

function fieldParser<K extends keyof ExifTags, R>(
  key: K,
  parser: (value: NonNullable<ExifTags[K]>) => R | null,
): MetadataParser<R> {
  return (data: StoredData): R | null => {
    let value: ExifTags[K] = data.exif[key];
    if (value === undefined) {
      return null;
    }

    // @ts-ignore
    return parser(value);
  };
}

function dateParser(date: string): DateTime | null {
  try {
    return parseDateTime(date);
  } catch (e) {
    return null;
  }
}

function rotationParser(data: StoredData): number | null {
  let value = data.exif.Rotation;
  if (value === undefined) {
    return null;
  }

  while (value < 0) {
    value += 360;
  }

  if (value < 45) {
    return 1;
  } else if (value < 135) {
    return 6;
  } else if (value < 225) {
    return 3;
  } else {
    return 8;
  }
}

function parse<T>(data: StoredData, parsers: MetadataParser<T>[]): T | null {
  for (let parser of parsers) {
    let result = parser(data);
    if (result !== null) {
      return result;
    }
  }

  return null;
}

function splitTakenParser(data: StoredData): DateTime | null {
  if (data.exif.DigitalCreationDate) {
    let datestr = data.exif.DigitalCreationDate;
    if (data.exif.DigitalCreationTime) {
      datestr += `T${data.exif.DigitalCreationTime}`;
    }

    try {
      return parseDateTime(datestr);
    } catch (e) {
      return null;
    }
  }

  return null;
}

function ignoreVideos(data: StoredData): number | null {
  if (data.mimetype.startsWith("video/")) {
    return 1;
  }
  return null;
}

function filenameParser(data: StoredData): string {
  return data.fileName;
}

function takenParser(data: StoredData): DateTime | null {
  let taken = parse(data, [
    fieldParser("SubSecDateTimeOriginal", dateParser),
    fieldParser("SubSecCreateDate", dateParser),
  ]);

  if (taken) {
    return taken;
  }

  taken = parse(data, [
    fieldParser("DateTimeOriginal", dateParser),
    fieldParser("DateTimeCreated", dateParser),
    fieldParser("CreateDate", dateParser),
    fieldParser("DigitalCreationDateTime", dateParser),
    splitTakenParser,
  ]);

  if (!taken) {
    return null;
  }

  let subsec = parse(data, [
    straight("SubSecTimeOriginal"),
    straight("SubSecTimeDigitized"),
    straight("SubSecTime"),
  ]);

  if (subsec) {
    dateTimeFromMillis(parseFloat(`0.${subsec}`) * 1000);
  }

  return taken;
}

function ratingParser(data: StoredData): number | null {
  if (data.exif.RatingPercent) {
    return Math.round(5 * data.exif.RatingPercent / 100);
  }

  if (data.exif.Rating) {
    return Math.max(0, Math.min(5, data.exif.Rating));
  }

  return null;
}

const parsers: MetadataParsers = {
  filename: [filenameParser],
  title: [straight("Title")],
  description: [
    straight("Description"),
    straight("ImageDescription"),
    straight("Caption-Abstract"),
  ],
  label: [straight("Label")],
  category: [straight("Category")],
  taken: [takenParser],
  takenZone: [],
  longitude: [straight("GPSLongitude")],
  latitude: [straight("GPSLatitude")],
  altitude: [straight("GPSAltitude")],
  location: [
    straight("Location"),
    straight("Sub-location"),
  ],
  city: [straight("City")],
  state: [
    straight("State"),
    straight("Province-State"),
  ],
  country: [
    straight("Country"),
    straight("Country-PrimaryLocationName"),
  ],
  orientation: [
    ignoreVideos,
    straight("Orientation"),
    rotationParser,
  ],
  make: [
    straight("Make"),
    forced<string>("AndroidManufacturer"),
  ],
  model: [
    straight("Model"),
    forced<string>("AndroidModel"),
  ],
  lens: [
    straight("Lens"),
    straight("LensModel"),
  ],
  photographer: [
    joined(straight("Creator")),
    straight("Artist"),
    straight("By-line"),
  ],
  aperture: [
    straight("FNumber"),
    straight("ApertureValue"),
  ],
  shutterSpeed: [
    straight("ExposureTime"),
    straight("ShutterSpeed"),
    straight("ShutterSpeedValue"),
  ],
  iso: [straight("ISO")],
  focalLength: [float(straight("FocalLength"))],
  rating: [ratingParser],
};

export function parseMetadata(data: StoredData): Nullable<ObjectModel.Metadata> {
  // @ts-ignore
  let metadata: Nullable<ObjectModel.Metadata> = Object.fromEntries(
    entries(parsers).map(
      <K extends keyof MetadataParsers>(
        [key, parsers]: [K, MetadataParser<ObjectModel.Metadata[K]>[]],
      ): [K, ObjectModel.Metadata[K] | null] => {
        for (let parser of parsers) {
          let result = parser(data);
          if (result) {
            return [key, result];
          }
        }

        return [key, null];
      },
    ),
  );

  return metadata;
}

function detectMimetype(file: string): Promise<string> {
  return new Promise((resolve: (mime: string) => void, reject: (err: Error) => void): void => {
    let magic = new Magic(MAGIC_MIME_TYPE);
    magic.detectFile(file, (err: Error | null, result: string | string[]): void => {
      if (err) {
        reject(err);
      } else {
        resolve(Array.isArray(result) ? result[0] : result);
      }
    });
  });
}

export async function parseFile(file: StoredFile): Promise<StoredData> {
  let exiftool = await Services.exiftool;
  let tags = await exiftool.read(file.path, ["-c", "-n"]);

  let mimetype = await detectMimetype(file.path);

  let exif: ExifTags = {
    ...Object.fromEntries(
      Object.entries(tags)
        .filter(([key, _value]: [string, unknown]): boolean => !(BadTags as string[]).includes(key))
        .map(([key, value]: [string, unknown]): [string, unknown] => {
          if (value instanceof ExifTime || value instanceof ExifDate ||
            value instanceof ExifDateTime) {
            return [key, value.toISOString()];
          }
          return [key, value];
        }),
    ),
  };

  // To avoid tests failing just because the exiftool version changed.
  delete exif.ExifToolVersion;

  let fileName = file.name ?? `original.${mimeExtension(mimetype)}`;

  if (mimetype.startsWith("image/")) {
    let stat = await fs.stat(file.path);
    let metadata = await sharp(file.path).metadata();
    return {
      exif,
      fileName,
      fileSize: stat.size,
      width: metadata.width ?? exif.ImageWidth ?? 0,
      height: metadata.height ?? exif.ImageHeight ?? 0,
      uploaded: file.uploaded,
      mimetype,
      duration: null,
      bitRate: null,
      frameRate: null,
    };
  }

  if (!mimetype.startsWith("video/")) {
    throw new Error(`Unknown mimetype ${mimetype}`);
  }

  let videoInfo = await probe(file.path);

  return {
    exif,
    fileName,
    fileSize: videoInfo.format.size,
    uploaded: file.uploaded,
    mimetype,
    width: videoInfo.videoStream?.width ?? 0,
    height: videoInfo.videoStream?.height ?? 0,
    duration: videoInfo.format.duration,
    bitRate: videoInfo.format.bitRate,
    frameRate: videoInfo.videoStream?.frameRate ?? null,
  };
}

export function getOriginal(
  data: StoredData,
): Omit<ObjectModel.Original, "id" | "media"> {
  let { uploaded, exif, fileName, ...info } = data;

  return {
    ...info,
    fileName,
    uploaded: uploaded,
  };
}
