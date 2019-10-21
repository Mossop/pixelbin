import { buildFormBody, request, buildJSONBody } from "./api";
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
    catalog: search.catalog.id
  }));

  if (response.ok) {
    return MediaArrayDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Search failed");
  }
}
