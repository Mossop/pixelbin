import { JsonDecoder, Ok, ok, err, Result } from "ts.data.json";
import moment from "moment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decode<A>(decoder: JsonDecoder.Decoder<A>, data: any): A {
  let result = decoder.decode(data);
  if (result instanceof Ok) {
    return result.value;
  }
  throw new Error(result.error);
}

function OptionalDecoder<A>(decoder: JsonDecoder.Decoder<A>, name: string): JsonDecoder.Decoder<undefined | A> {
  return JsonDecoder.oneOf([JsonDecoder.isNull(undefined), JsonDecoder.isUndefined(undefined), decoder], `${name}?`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DateDecoder = new JsonDecoder.Decoder<moment.Moment>((json: any): Result<moment.Moment> => {
  if (typeof json === "string") {
    try {
      return ok<moment.Moment>(moment(json, moment.ISO_8601));
    } catch (e) {
      return err<moment.Moment>(`'${json}' could not be parsed as ISO 8601: ${e}`);
    }
  }
  return err<moment.Moment>(`'${json}' is not a string.`);
});

export interface UserInfo {
  email: string;
  fullname: string;
}

export const UserInfoDecoder = JsonDecoder.object<UserInfo>(
  {
    email: JsonDecoder.string,
    fullname: JsonDecoder.string,
  },
  "State"
);

export interface UserState {
  user?: UserInfo;
}

export const UserStateDecoder = JsonDecoder.object<UserState>(
  {
    user: OptionalDecoder(UserInfoDecoder, "User"),
  },
  "UserState"
);

export interface Tag {
  id: number;
  name: string;
  path: string;
  children: Tag[];
}

export const TagDecoder = JsonDecoder.object<Tag>(
  {
    id: JsonDecoder.number,
    name: JsonDecoder.string,
    path: JsonDecoder.string,
    children: JsonDecoder.array<Tag>(JsonDecoder.lazy<Tag>(() => TagDecoder), "Tag[]"),
  },
  "State"
);

export interface Media {
  id: number;
  processed: boolean;

  tags: string[];
  longitude: number;
  latitude: number;
  taken: moment.Moment;

  mimetype: string;
  width: number;
  height: number;
}

export const MediaDecoder = JsonDecoder.object<Media>(
  {
    id: JsonDecoder.number,
    processed: JsonDecoder.boolean,

    tags: JsonDecoder.array<string>(JsonDecoder.string, "path[]"),
    longitude: JsonDecoder.number,
    latitude: JsonDecoder.number,
    taken: DateDecoder,

    mimetype: JsonDecoder.string,
    width: JsonDecoder.number,
    height: JsonDecoder.number,
  },
  "Media"
);

export const MediaArrayDecoder = JsonDecoder.array<Media>(MediaDecoder, "Media[]");

export interface UploadMetadata {
  tags: string;
  taken: moment.Moment;
  latitude?: number;
  longitude?: number;
}

export interface UploadResponse {
  tags: Tag[];
  media: Media;
}

export const UploadResponseDecoder = JsonDecoder.object<UploadResponse>(
  {
    tags: JsonDecoder.array<Tag>(TagDecoder, "Tag[]"),
    media: MediaDecoder,
  },
  "UploadResponseDecoder"
);
