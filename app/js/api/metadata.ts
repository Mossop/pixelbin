import { Orientation } from "media-metadata/lib/metadata";
import moment from "moment";
import { JsonDecoder, Result, err, ok } from "ts.data.json";

import { decode } from "../utils/decoders";
import { MediaData } from "./media";
import { MediaCreateData, MetadataUpdateData, MetadataData } from "./types";

type MediaWithMetadata = MediaData | MediaCreateData;

const MetadataFields: Map<string, MetadataField> = new Map();

abstract class MetadataField {
  public readonly key: string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(key: string, _: object) {
    this.key = key;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get(metadata: MetadataData): any {
    return metadata[this.key];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected set(metadata: MetadataUpdateData, value: any): void {
    metadata[this.key] = value;
  }

  public delete(metadata: MetadataUpdateData): void {
    delete metadata[this.key];
  }
}

abstract class BaseMetadataField<T> extends MetadataField {
  public getValue(metadata: MetadataData): T | undefined {
    return this.get(metadata);
  }

  public setValue(metadata: MetadataUpdateData, value: T): void {
    this.set(metadata, value);
  }

  public deleteValue(metadata: MetadataUpdateData): void {
    this.delete(metadata);
  }
}

class StringMetadataField extends BaseMetadataField<string> {
}

class IntegerMetadataField extends BaseMetadataField<number> {
  public getValue(metadata: MetadataData): number | undefined {
    let val = this.get(metadata);
    return typeof val == "number" ? Math.round(val) : val;
  }

  public setValue(metadata: MetadataUpdateData, value: number): void {
    this.set(metadata, Math.round(value));
  }
}

class FloatMetadataField extends BaseMetadataField<number> {
}

class DateTimeMetadataField extends BaseMetadataField<moment.Moment> {
}

const MetadataFieldDecoder =
  new JsonDecoder.Decoder<MetadataField>((json: unknown): Result<MetadataField> => {
    if (typeof json != "object" || !json) {
      return err<MetadataField>(`Expected an object, got a ${typeof json}`);
    }

    try {
      let key = decode(JsonDecoder.string, json["key"]);
      let type = decode(JsonDecoder.string, json["type"]);
      switch (type) {
        case "string":
          return ok<MetadataField>(new StringMetadataField(key, json));
        case "float":
          return ok<MetadataField>(new FloatMetadataField(key, json));
        case "integer":
          return ok<MetadataField>(new IntegerMetadataField(key, json));
        case "datetime":
          return ok<MetadataField>(new DateTimeMetadataField(key, json));
        case "orientation":
          return ok<MetadataField>(new IntegerMetadataField(key, json));
        default:
          return err<MetadataField>(`Unknown metadata field type ${type}.`);
      }
    } catch (e) {
      return err<MetadataField>(e.toString());
    }
  });

let metadataElement = document.getElementById("metadata");
if (metadataElement?.textContent) {
  try {
    let fields = decode(
      JsonDecoder.array<MetadataField>(MetadataFieldDecoder, "MetadataField"),
      JSON.parse(metadataElement.textContent),
    );
    for (let field of fields) {
      MetadataFields.set(field.key, field);
    }
  } catch (e) {
    console.error(e);
  }
}

type FieldConstructor<T> = new (key: string, spec: {}) => BaseMetadataField<T>;

function getFieldInstance<T>(key: string, cls: FieldConstructor<T>): BaseMetadataField<T> {
  let field = MetadataFields.get(key);
  if (!field) {
    throw new Error(`Attempt to access unknown metadata field ${key}.`);
  }

  if (field instanceof cls) {
    return field;
  }

  throw new Error(`Field ${key} did not have the expected type.`);
}

type FieldGetter<T> = (media: MediaWithMetadata, key: string) => T | undefined;
type FieldSetter<T> = (media: MediaWithMetadata, key: string, value: T) => void;

function buildFieldGetter<T>(cls: FieldConstructor<T>): FieldGetter<T> {
  return (media: MediaData, key: string): T | undefined => {
    let field: BaseMetadataField<T> = getFieldInstance(key, cls);
    return field.getValue(media.metadata);
  };
}

function buildFieldSetter<T>(cls: FieldConstructor<T>): FieldSetter<T> {
  return (media: MediaCreateData, key: string, value: T): void => {
    let field: BaseMetadataField<T> = getFieldInstance(key, cls);
    if (!media.metadata) {
      media.metadata = {};
    }
    return field.setValue(media.metadata, value);
  };
}

export function deleteValue(media: MediaCreateData, key: string): void {
  let field: MetadataField | undefined = MetadataFields.get(key);
  if (field) {
    if (!media.metadata) {
      return;
    }
    field.delete(media.metadata);
  }
}

export const getStringValue = buildFieldGetter(StringMetadataField);
export const setStringValue = buildFieldSetter(StringMetadataField);
export const getFloatValue = buildFieldGetter(FloatMetadataField);
export const setFloatValue = buildFieldSetter(FloatMetadataField);
export const getIntegerValue = buildFieldGetter(IntegerMetadataField);
export const setIntegerValue = buildFieldSetter(IntegerMetadataField);
export const getDateValue = buildFieldGetter(DateTimeMetadataField);
export const setDateValue = buildFieldSetter(DateTimeMetadataField);

export function getOrientation(media: MediaData): Orientation {
  return getIntegerValue(media, "orientation") ?? Orientation.TopLeft;
}

export function setOrientation(media: MediaCreateData, value: Orientation): void {
  setIntegerValue(media, "orientation", value);
}
