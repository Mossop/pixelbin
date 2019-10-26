import { buildFormBody, request, buildJSONBody, getRequest, baseRequest, apiURL } from "./api";
import { Catalog, UploadMetadata, Album, Media, MediaArrayDecoder, MediaDecoder } from "./types";
import { Immutable } from "immer";
import { Search } from "../utils/search";
import { intoIds, intoId, MapId } from "../utils/maps";

export async function get(id: string): Promise<Media> {
  let url = apiURL("media/get");
  url.searchParams.set("id", id);

  return request({
    url,
    method: "GET",
    decoder: MediaDecoder,
  });
}

export async function upload(catalog: MapId<Catalog>, metadata: Immutable<UploadMetadata>, file: Blob): Promise<Media> {
  return request({
    url: "media/upload",
    method: "PUT",
    body: buildFormBody({
      metadata: JSON.stringify({
        catalog: intoId(catalog),
        ...metadata,
      }),
      file,
    }),
    decoder: MediaDecoder,
  });
}

export async function modifyAlbums(media: MapId<Media>, addAlbums: MapId<Album>[] = [], removeAlbums: MapId<Album>[] = []): Promise<void> {
  await baseRequest({
    url: "albums/edit",
    method: "PATCH",
    body: buildJSONBody({
      media: intoId(media),
      addAlbums: intoIds(addAlbums),
      removeAlbums: intoIds(removeAlbums),
    }),
  });
}

export async function search(search: Search): Promise<Media[]> {
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
  let response = await getRequest("media/thumbnail", {
    media: intoId(media),
    size: String(size),
  });

  return createImageBitmap(await response.blob());
}
