import { buildFormBody, request, buildJSONBody, getRequest } from "./api";
import { Catalog, UploadMetadata, Album, Media, MediaArrayDecoder } from "./types";
import { Immutable } from "immer";
import { Search } from "../utils/search";

export async function upload(catalog: Catalog, parentAlbum: Album | undefined, metadata: Immutable<UploadMetadata>, file: Blob): Promise<void> {
  let data = {
    catalog: catalog.id,
    album: parentAlbum ? parentAlbum.id : undefined,
    ...metadata,
  };

  let body = buildFormBody({
    metadata: JSON.stringify(data),
    file,
  });

  let response = await request("media/upload", "PUT", body);

  if (response.ok) {
    return;
  } else {
    throw new Error("Failed to upload file.");
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
