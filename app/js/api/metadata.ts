import { JsonDecoder, Result, err, ok } from "ts.data.json";
import moment from "moment";
import { Orientation } from "media-metadata/lib/metadata";

import { DateDecoder, decode } from "../utils/decoders";
import { UnprocessedMediaData } from "./types";

export interface Metadata {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const MetadataFields: Map<string, MetadataField> = new Map();

abstract class MetadataField {
  public readonly key: string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(key: string, _: object) {
    this.key = key;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get(media: Partial<UnprocessedMediaData>): any {
    if (media.metadata) {
      return media.metadata[this.key];
    }
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected set(media: Partial<UnprocessedMediaData>, value: any): void {
    if (media.metadata) {
      media.metadata[this.key] = value;
    } else {
      media.metadata = {
        [this.key]: value,
      };
    }
  }

  public delete(media: Partial<UnprocessedMediaData>): void {
    if (media.metadata) {
      delete media.metadata[this.key];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public abstract decoder(): JsonDecoder.Decoder<any>;
}

abstract class BaseMetadataField<T> extends MetadataField {
  public abstract decoder(): JsonDecoder.Decoder<T | undefined>;

  public getValue(media: Partial<UnprocessedMediaData>): T | undefined {
    return this.get(media);
  }

  public setValue(media: Partial<UnprocessedMediaData>, value: T): void {
    this.set(media, value);
  }

  public deleteValue(media: Partial<UnprocessedMediaData>): void {
    this.delete(media);
  }
}

class StringMetadataField extends BaseMetadataField<string> {
  public decoder(): JsonDecoder.Decoder<string | undefined> {
    return JsonDecoder.optional(JsonDecoder.string);
  }
}

class IntegerMetadataField extends BaseMetadataField<number> {
  public decoder(): JsonDecoder.Decoder<number | undefined> {
    return JsonDecoder.optional(JsonDecoder.number);
  }

  public getValue(media: Partial<UnprocessedMediaData>): number | undefined {
    let val = this.get(media);
    return typeof val == "number" ? Math.round(val) : val;
  }

  public setValue(media: UnprocessedMediaData, value: number): void {
    this.set(media, Math.round(value));
  }
}

class FloatMetadataField extends BaseMetadataField<number> {
  public decoder(): JsonDecoder.Decoder<number | undefined> {
    return JsonDecoder.optional(JsonDecoder.number);
  }
}

class DateTimeMetadataField extends BaseMetadataField<moment.Moment> {
  public decoder(): JsonDecoder.Decoder<moment.Moment | undefined> {
    return JsonDecoder.optional(DateDecoder);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MetadataFieldDecoder = new JsonDecoder.Decoder<MetadataField>((json: any): Result<MetadataField> => {
  if (typeof json != "object") {
    return err<MetadataField>(`Expected an object, got a ${typeof json}`);
  }

  try {
    let key = decode(JsonDecoder.string, json.key);
    let type = decode(JsonDecoder.string, json.type);
    switch (type) {
      case "string":
        return ok<MetadataField>(new StringMetadataField(key, json));
      case "float":
        return ok<MetadataField>(new FloatMetadataField(key, json));
      case "integer":
        return ok<MetadataField>(new IntegerMetadataField(key, json));
      case "datetime":
        return ok<MetadataField>(new DateTimeMetadataField(key, json));
      default:
        return err<MetadataField>(`Unknown metadata field type ${type}.`);
    }
  } catch (e) {
    return err<MetadataField>(e.toString());
  }
});

let metadataElement = document.getElementById("metadata");
if (metadataElement && metadataElement.textContent) {
  try {
    let fields = decode(JsonDecoder.array<MetadataField>(MetadataFieldDecoder, "MetadataField"),
      JSON.parse(metadataElement.textContent));
    for (let field of fields) {
      MetadataFields.set(field.key, field);
    }
  } catch (e) {
    console.error(e);
  }
}

const decoderSpec: Metadata = {};
for (let field of MetadataFields.values()) {
  decoderSpec[field.key] = field.decoder();
}

export const MetadataDecoder = JsonDecoder.object<Metadata>(
  decoderSpec,
  "Metadata"
);

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

type FieldGetter<T> = (media: UnprocessedMediaData, key: string) => T | undefined;
type FieldSetter<T> = (media: Partial<UnprocessedMediaData>, key: string, value: T) => void;

function buildFieldGetter<T>(cls: FieldConstructor<T>): FieldGetter<T> {
  return (media: UnprocessedMediaData, key: string): T | undefined => {
    let field: BaseMetadataField<T> = getFieldInstance(key, cls);
    return field.getValue(media);
  };
}

function buildFieldSetter<T>(cls: FieldConstructor<T>): FieldSetter<T> {
  return (media: Partial<UnprocessedMediaData>, key: string, value: T): void => {
    let field: BaseMetadataField<T> = getFieldInstance(key, cls);
    return field.setValue(media, value);
  };
}

export function deleteValue(media: Partial<UnprocessedMediaData>, key: string): void {
  let field: MetadataField | undefined = MetadataFields.get(key);
  if (field) {
    field.delete(media);
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

export function getOrientation(media: UnprocessedMediaData): Orientation {
  return getIntegerValue(media, "orientation") || Orientation.TopLeft;
}

export function setOrientation(media: Partial<UnprocessedMediaData>, value: Orientation): void {
  setIntegerValue(media, "orientation", value);
}
