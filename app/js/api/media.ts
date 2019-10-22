import { buildFormBody, request, buildJSONBody, getRequest } from "./api";
import { Catalog, UploadMetadata, Album, Media, MediaArrayDecoder, MediaDecoder } from "./types";
import { Immutable } from "immer";
import { Search } from "../utils/search";

export async function upload(catalog: Catalog, metadata: Immutable<UploadMetadata>, file: Blob): Promise<Media> {
  let data = {
    catalog: catalog.id,
    ...metadata,
  };

  let body = buildFormBody({
    metadata: JSON.stringify(data),
    file,
  });

  let response = await request("media/upload", "PUT", body);

  if (response.ok) {
    return MediaDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Failed to upload file.");
  }
}

export async function addToAlbums(media: Media | string, albums: Album[]): Promise<void> {
  let response = await request("albums/add", "PUT", buildJSONBody({
    media: typeof media === "string" ? media : media.id,
    albums: albums.map((a: Album): string => a.id),
  }));

  if (response.ok) {
    return;
  } else {
    throw new Error("Failed to add to albums.");
  }
}

export async function modifyAlbums(media: Media | string, addAlbums: Album[] = [], removeAlbums: Album[] = []): Promise<void> {
  let response = await request("albums/edit", "POST", buildJSONBody({
    media: typeof media === "string" ? media : media.id,
    addAlbums: addAlbums.map((a: Album): string => a.id),
    removeAlbums: removeAlbums.map((a: Album): string => a.id),
  }));

  if (response.ok) {
    return;
  } else {
    throw new Error("Failed to remove from albums.");
  }
}

export async function search(search: Search): Promise<Media[]> {
  let response = await request("media/search", "POST", buildJSONBody({
    catalog: search.catalog.id,
    query: search.query,
  }));

  if (response.ok) {
    return MediaArrayDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Search failed");
  }
}

export async function thumbnail(media: Media, size: number): Promise<ImageBitmap> {
  let response = await getRequest("media/thumbnail", {
    media: media.id,
    size: String(size),
  });

  if (response.ok) {
    return createImageBitmap(await response.blob());
  } else {
    throw new Error("Thumbnail failed");
  }
}
