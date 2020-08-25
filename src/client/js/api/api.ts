import { Api } from "../../../model";
import * as Decoders from "./decoders";
import {
  BlobDecoder,
  Decoder,
  JsonDecoderDecoder,
  JsonRequestData,
  makeRequest,
  QueryRequestData,
  RequestData,
} from "./helpers";

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
  [Api.Method.CatalogCreate]: JsonDecoderDecoder(Decoders.CatalogDecoder),
  [Api.Method.AlbumCreate]: JsonDecoderDecoder(Decoders.AlbumDecoder),
  [Api.Method.AlbumEdit]: JsonDecoderDecoder(Decoders.AlbumDecoder),
  [Api.Method.AlbumList]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Api.Method.TagCreate]: JsonDecoderDecoder(Decoders.TagDecoder),
  [Api.Method.TagEdit]: JsonDecoderDecoder(Decoders.TagDecoder),
  [Api.Method.PersonCreate]: JsonDecoderDecoder(Decoders.PersonDecoder),
  [Api.Method.PersonEdit]: JsonDecoderDecoder(Decoders.PersonDecoder),
  [Api.Method.MediaCreate]: JsonDecoderDecoder(Decoders.UnprocessedMediaDecoder),
  [Api.Method.MediaGet]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
  [Api.Method.MediaThumbnail]: BlobDecoder,
  [Api.Method.MediaRelations]: JsonDecoderDecoder(Decoders.MediaArrayDecoder),
};

export function request<T extends Api.Method>(
  method: T,
  ...data: RequestType<T>
): Promise<ResponseType<T>> {
  let request: RequestData<ResponseType<T>>;
  if (Api.HttpMethods[method] == "GET") {
    // @ts-ignore: Trust me
    request = new QueryRequestData<ResponseType<T>>(data[0], decoders[method]);
  } else {
    // @ts-ignore: Trust me
    request = new JsonRequestData<ResponseType<T>>(data[0], decoders[method]);
  }

  return makeRequest(Api.HttpMethods[method], method, request);
}
