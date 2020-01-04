import { Search } from "../utils/search";
import { intoId, MapId } from "../utils/maps";
import { request, buildJSONBody, apiURL, buildFormBody, baseRequest, buildGetURL } from "./api";
import { Media, MediaArrayDecoder, MediaDecoder, UnprocessedMedia, UnprocessedMediaDecoder, Catalog } from "./types";

export async function getMedia(id: string): Promise<Media> {
  let url = apiURL(`media/get/${id}`);

  return request({
    url,
    decoder: MediaDecoder,
  });
}

export async function createMedia(catalog: MapId<Catalog>, media: Partial<UnprocessedMedia>): Promise<UnprocessedMedia> {
  return request({
    url: "media/create",
    method: "PUT",
    body: buildJSONBody(Object.assign({}, media, { catalog: intoId(catalog) })),
    decoder: UnprocessedMediaDecoder,
  });
}

export async function uploadMedia(media: MapId<Media>, file: File): Promise<void> {
  await baseRequest({
    url: `media/upload/${intoId(media)}`,
    method: "PUT",
    body: buildFormBody({
      file: file,
    })
  });
}

export async function searchMedia(search: Search): Promise<Media[]> {
  return request({
    url: "media/search",
    method: "POST",
    body: buildJSONBody({
      catalog: search.catalog.id,
      query: search.query,
    }),
    decoder: MediaArrayDecoder,
  });
}

export async function thumbnail(media: MapId<Media>, size: number): Promise<ImageBitmap> {
  let response = await baseRequest({
    url: buildGetURL(`media/thumbnail/${intoId(media)}`, {
      size: String(size),
    }),
  });

  return createImageBitmap(await response.blob());
}
