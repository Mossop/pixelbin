import { parse as parseCookie } from "cookie";
import { JsonDecoder } from "ts.data.json";

import type { Api } from "../../model";
import { HttpMethods, Method } from "../../model";
import { CSRF_COOKIE, CSRF_HEADER } from "../../model/api";
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

export type RequestType<T extends Method> =
  Api.Signatures[T] extends Api.Signature<infer Request>
    ? Request extends Api.None
      ? []
      : [Request]
    : never;
export type ResponseType<T extends Method> =
  Api.Signatures[T] extends Api.Signature<unknown, infer Response> ? Response : never;

export type ResponseDecoders = {
  [Key in keyof Api.Signatures]: Decoder<ResponseType<Key>>;
};

const decoders: ResponseDecoders = {
  [Method.State]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Method.Login]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Method.Logout]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Method.Signup]: JsonDecoderDecoder(Decoders.StateDecoder),
  [Method.StorageTest]: JsonDecoderDecoder(Decoders.StorageTestResultDecoder),
  [Method.StorageCreate]: JsonDecoderDecoder(Decoders.StorageDecoder),
  [Method.CatalogEdit]: JsonDecoderDecoder(Decoders.CatalogDecoder),
  [Method.CatalogCreate]: JsonDecoderDecoder(Decoders.CatalogDecoder),
  [Method.CatalogList]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Method.AlbumCreate]: JsonDecoderDecoder(Decoders.AlbumDecoder),
  [Method.AlbumEdit]: JsonDecoderDecoder(Decoders.AlbumDecoder),
  [Method.AlbumList]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Method.AlbumDelete]: VoidDecoder,
  [Method.TagCreate]: JsonDecoderDecoder(Decoders.TagDecoder),
  [Method.TagEdit]: JsonDecoderDecoder(Decoders.TagDecoder),
  [Method.TagFind]: JsonDecoderDecoder(JsonDecoder.array(Decoders.TagDecoder, "Tag[]")),
  [Method.TagDelete]: VoidDecoder,
  [Method.PersonCreate]: JsonDecoderDecoder(Decoders.PersonDecoder),
  [Method.PersonEdit]: JsonDecoderDecoder(Decoders.PersonDecoder),
  [Method.PersonDelete]: VoidDecoder,
  [Method.MediaCreate]: JsonDecoderDecoder(Decoders.MediaDecoder),
  [Method.MediaGet]: JsonDecoderDecoder(Decoders.MaybeMediaArrayDecoder),
  [Method.MediaSearch]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Method.MediaEdit]: JsonDecoderDecoder(Decoders.MediaDecoder),
  [Method.MediaRelations]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Method.MediaPeople]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Method.MediaDelete]: VoidDecoder,
  [Method.SavedSearchCreate]: JsonDecoderDecoder(Decoders.SavedSearchDecoder),
  [Method.SavedSearchEdit]: JsonDecoderDecoder(Decoders.SavedSearchDecoder),
  [Method.SavedSearchDelete]: VoidDecoder,
};

export async function request<T extends Method>(
  method: T,
  ...[requestData]: RequestType<T>
): Promise<ResponseType<T>> {
  let url = appURL(Url.API, method);

  let headers: Record<string, string> = {};
  headers[CSRF_HEADER] = parseCookie(document.cookie)[CSRF_COOKIE];

  let body: string | Record<string, string | Blob> | null = null;

  if (typeof requestData == "object" && requestData) {
    if (HttpMethods[method] == "GET") {
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
      method: HttpMethods[method],
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
