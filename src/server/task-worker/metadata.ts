import { ExifDate, ExifDateTime, ExifTime, Tags } from "exiftool-vendored";
import moment, { Moment } from "moment-timezone";

import { Metadata } from "../../model/models";
import { entries } from "../../utils";

type StoredTag<T> =
  T extends ExifDate | ExifDateTime | ExifTime ? string : T;

export type StoredTags = {
  [K in keyof Tags]?: StoredTag<Tags[K]>;
};

type MetadataParser<T> = (tags: StoredTags) => T | null;

type MetadataParsers = {
  [K in keyof Metadata]: MetadataParser<Metadata[K]>[];
};

function straight<K extends keyof StoredTags>(key: K): MetadataParser<NonNullable<StoredTags[K]>> {
  return (tags: StoredTags): NonNullable<StoredTags[K]> | null => {
    if (tags[key] === undefined) {
      return null;
    }

    // @ts-ignore: This is definitely correct.
    return tags[key];
  };
}

function forced<T>(key: string): MetadataParser<T> {
  return (tags: StoredTags): T | null => {
    if (tags[key] === undefined) {
      return null;
    }

    return tags[key] as T;
  };
}

function joined(inner: MetadataParser<string[]>): MetadataParser<string> {
  return (tags: StoredTags): string | null => {
    let strs = inner(tags);
    if (!strs || strs.length == 0) {
      return null;
    }

    return strs.join(", ");
  };
}

function float(inner: MetadataParser<string>): MetadataParser<number> {
  return (tags: StoredTags): number | null => {
    let str = inner(tags);
    if (!str) {
      return null;
    }

    return parseFloat(str);
  };
}

type StringArrayKeys = {
  [K in keyof StoredTags]: StoredTags[K] extends string[] ? K : never;
}[keyof StoredTags];

function fieldParser<K extends keyof StoredTags, R>(
  key: K,
  parser: (value: NonNullable<StoredTags[K]>) => R | null,
): MetadataParser<R> {
  return (metadata: StoredTags): R | null => {
    let value: StoredTags[K] = metadata[key];
    if (value === undefined) {
      return null;
    }

    // @ts-ignore: This is definitely correct.
    return parser(value);
  };
}

function dateParser(date: string): Moment | null {
  try {
    return moment(date);
  } catch (e) {
    return null;
  }
}

function rotationParser(tags: StoredTags): number | null {
  let value = tags.Rotation;
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

function parse<T>(tags: StoredTags, parsers: MetadataParser<T>[]): T | null {
  for (let parser of parsers) {
    let result = parser(tags);
    if (result !== null) {
      return result;
    }
  }

  return null;
}

function splitTakenParser(tags: StoredTags): Moment | null {
  if (tags.DigitalCreationDate) {
    let datestr = tags.DigitalCreationDate;
    if (tags.DigitalCreationTime) {
      datestr += `T${tags.DigitalCreationTime}`;
    }

    try {
      return moment(datestr);
    } catch (e) {
      return null;
    }
  }

  return null;
}

function takenParser(tags: StoredTags): Moment | null {
  let taken = parse(tags, [
    fieldParser("SubSecDateTimeOriginal", dateParser),
    fieldParser("SubSecCreateDate", dateParser),
  ]);

  if (taken) {
    return taken;
  }

  taken = parse(tags, [
    fieldParser("DateTimeOriginal", dateParser),
    fieldParser("CreateDate", dateParser),
    fieldParser("DateTimeCreated", dateParser),
    fieldParser("DigitalCreationDateTime", dateParser),
    splitTakenParser,
  ]);

  if (!taken) {
    return null;
  }

  let subsec = parse(tags, [
    straight("SubSecTimeOriginal"),
    straight("SubSecTimeDigitized"),
    straight("SubSecTime"),
  ]);

  if (subsec) {
    taken.millisecond(parseFloat(`0.${subsec}`) * 1000);
  }

  return taken;
}

const parsers: MetadataParsers = {
  filename: [straight("FileName")],
  title: [straight("Title")],
  taken: [takenParser],
  offset: [],
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
    straight("Orientation"),
    rotationParser,
  ],
  make: [
    straight("Make"),
    forced<string>("ComAndroidManufacturer"),
  ],
  model: [
    straight("Model"),
    forced<string>("ComAndroidModel"),
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
  exposure: [
    float(straight("ExposureTime")),
    float(straight("ShutterSpeed")),
    float(straight("ShutterSpeedValue")),
  ],
  iso: [straight("ISO")],
  focalLength: [float(straight("FocalLength"))],
  bitrate: [float(straight("AvgBitrate"))],
};

export function parseMetadata(tags: StoredTags): Metadata {
  // @ts-ignore: I hate fromEntries!
  let metadata: Metadata = Object.fromEntries(
    entries(parsers).map(
      <K extends keyof MetadataParsers>(
        [key, parsers]: [K, MetadataParser<Metadata[K]>[]],
      ): [K, Metadata[K] | null] => {
        for (let parser of parsers) {
          let result = parser(tags);
          if (result) {
            return [key, result];
          }
        }

        return [key, null];
      },
    ),
  );

  if (metadata.taken) {
    metadata.offset = metadata.taken.utcOffset();
  }

  return metadata;
}
