import { Orientation } from "media-metadata";
import moment from "moment";
import { decode } from "pixelbin-utils";
import { JsonDecoder, err, ok } from "ts.data.json";
import type { Result } from "ts.data.json";

import { document } from "../environment";
import { ErrorCode, exception } from "../utils/exception";
import type { MediaData, MediaCreateData, MetadataUpdateData } from "./types";

type MediaWithMetadata = MediaData | MediaCreateData;

const MetadataFields: Map<string, MetadataField> = new Map<string, MetadataField>();

abstract class MetadataField {
  public constructor(public readonly key: string) {
  }

  protected get(metadata: MetadataUpdateData): unknown {
    return metadata[this.key] as unknown;
  }

  protected set(metadata: MetadataUpdateData, value: unknown): void {
    metadata[this.key] = value;
  }

  public delete(metadata: MetadataUpdateData): void {
    delete metadata[this.key];
  }
}

abstract class BaseMetadataField<T> extends MetadataField {
  public getValue(metadata: MetadataUpdateData): T | null {
    return this.get(metadata) as T || null;
  }

  public setValue(metadata: MetadataUpdateData, value: T | null): void {
    this.set(metadata, value);
  }

  public deleteValue(metadata: MetadataUpdateData): void {
    this.delete(metadata);
  }
}

class StringMetadataField extends BaseMetadataField<string> {
}

class IntegerMetadataField extends BaseMetadataField<number> {
  public getValue(metadata: MetadataUpdateData): number | null {
    let val = this.get(metadata);
    return typeof val == "number" ? Math.round(val) : null;
  }

  public setValue(metadata: MetadataUpdateData, value: number | null): void {
    this.set(metadata, value ? Math.round(value) : null);
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
          return ok<MetadataField>(new StringMetadataField(key));
        case "float":
          return ok<MetadataField>(new FloatMetadataField(key));
        case "integer":
          return ok<MetadataField>(new IntegerMetadataField(key));
        case "datetime":
          return ok<MetadataField>(new DateTimeMetadataField(key));
        case "orientation":
          return ok<MetadataField>(new IntegerMetadataField(key));
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

type FieldConstructor<T> = new (key: string) => BaseMetadataField<T>;

function getFieldInstance<T>(key: string, cls: FieldConstructor<T>): BaseMetadataField<T> {
  let field = MetadataFields.get(key);
  if (!field) {
    exception(ErrorCode.UnknownField, {
      field: key,
    });
  }

  if (field instanceof cls) {
    return field;
  }

  exception(ErrorCode.UnexpectedType, {
    expected: cls.name,
    found: field.constructor.name,
  });
}

type FieldGetter<T> = (media: MediaWithMetadata, key: string) => T | null;
type FieldSetter<T> = (media: MediaCreateData, key: string, value: T) => void;

function buildFieldGetter<T>(cls: FieldConstructor<T>): FieldGetter<T> {
  return (media: MediaWithMetadata, key: string): T | null => {
    if (!media.metadata) {
      return null;
    }

    let field: BaseMetadataField<T> = getFieldInstance(key, cls);
    return field.getValue(media.metadata);
  };
}

function buildFieldSetter<T>(cls: FieldConstructor<T>): FieldSetter<T> {
  return (media: MediaCreateData, key: string, value: T): void => {
    if (!media.metadata) {
      media.metadata = {};
    }

    let field: BaseMetadataField<T> = getFieldInstance(key, cls);
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
