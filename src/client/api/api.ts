import { parse as parseCookie } from "cookie";
import { JsonDecoder } from "ts.data.json";

import { Api } from "../../model";
import { appURL, Url } from "../context";
import { fetch, document } from "../environment";
import { ApiError, ErrorCode, exception } from "../utils/exception";
import { formParams } from "../utils/formdata";
import * as Decoders from "./decoders";

export type Decoder<T> = (response: Response) => Promise<T>;

export const VoidDecoder: Decoder<void> = async (_: Response): Promise<void> => {
  return;
};
export const BlobDecoder: Decoder<Blob> = (response: Response): Promise<Blob> => response.blob();
export function JsonDecoderDecoder<D>(decoder: JsonDecoder.Decoder<D>): Decoder<D> {
  return async (response: Response): Promise<D> => decoder.decodePromise(await response.json());
}

export type RequestType<T extends Api.Method> =
  Api.Signatures[T] extends Api.Signature<infer Request>
    ? Request extends Api.None
      ? []
      : [Request]
    : never;
export type ResponseType<T extends Api.Method> =
  Api.Signatures[T] extends Api.Signature<unknown, infer Response> ? Response : never;

export type ResponseDecoders = {
  [Key in keyof Api.Signatures]: Decoder<ResponseType<Key>>;
};

const decoders: ResponseDecoders = {
  [Api.Method.State]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Api.Method.Login]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Api.Method.Logout]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Api.Method.Signup]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Api.Method.StorageTest]: JsonDecoderDecoder(Decoders.StorageTestResultDecoder),
  [Api.Method.StorageCreate]: JsonDecoderDecoder(Decoders.StorageDecoder),
  [Api.Method.CatalogCreate]: JsonDecoderDecoder(Decoders.CatalogDecoder),
  [Api.Method.AlbumCreate]: JsonDecoderDecoder(Decoders.AlbumDecoder),
  [Api.Method.AlbumEdit]: JsonDecoderDecoder(Decoders.AlbumDecoder),
  [Api.Method.AlbumList]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Api.Method.TagCreate]: JsonDecoderDecoder(Decoders.TagDecoder),
  [Api.Method.TagEdit]: JsonDecoderDecoder(Decoders.TagDecoder),
  [Api.Method.TagFind]: JsonDecoderDecoder(JsonDecoder.array(Decoders.TagDecoder, "Tag[]")),
  [Api.Method.PersonCreate]: JsonDecoderDecoder(Decoders.PersonDecoder),
  [Api.Method.PersonEdit]: JsonDecoderDecoder(Decoders.PersonDecoder),
  [Api.Method.MediaCreate]: JsonDecoderDecoder(Decoders.UnprocessedMediaDecoder),
  [Api.Method.MediaGet]: JsonDecoderDecoder(Decoders.MaybeMediaArrayDecoder),
  [Api.Method.MediaEdit]: JsonDecoderDecoder(Decoders.MediaDecoder),
  [Api.Method.MediaRelations]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Api.Method.MediaPeople]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Api.Method.MediaDelete]: VoidDecoder,
};

export async function request<T extends Api.Method>(
  method: T,
  ...[requestData]: RequestType<T>
): Promise<ResponseType<T>> {
  let url = appURL(Url.API, method);

  let headers: Record<string, string> = {};
  headers["X-CSRFToken"] = parseCookie(document.cookie)["csrftoken"];

  let body: string | Record<string, string | Blob> | null = null;

  if (typeof requestData == "object" && requestData) {
    if (Api.HttpMethods[method] == "GET") {
      for (let [key, value] of formParams(requestData)) {
        if (value instanceof Blob) {
          exception(ErrorCode.InvalidData, {
            detail: "Attempted to pass a Blob through a GET request.",
          });
        }
        url.searchParams.append(key, value);
      }
    } else if (!Array.isArray(requestData)) {
      let json = {};
      body = {};
      let hasBlob = false;

      for (let [key, value] of Object.entries(requestData)) {
        if (value instanceof Blob) {
          body[key] = value;
          hasBlob = true;
        } else {
          json[key] = value;
        }
      }

      if (hasBlob) {
        body.json = JSON.stringify(json);
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(requestData);
      }
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(requestData);
    }
  }

  let response: Response;
  try {
    response = await fetch(url.href, {
      method: Api.HttpMethods[method],
      headers,
    }, body);
  } catch (e) {
    exception(ErrorCode.RequestFailed, undefined, e);
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await Decoders.ErrorDataDecoder.decodePromise(await response.json());
    } catch (e) {
      exception(ErrorCode.DecodeError, undefined, e);
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  try {
    let decoder = decoders[method] as Decoder<ResponseType<T>>;
    return await decoder(response);
  } catch (e) {
    exception(ErrorCode.DecodeError, undefined, e);
  }
}
