import { buildFormBody, request } from "./api";
import { Catalog, UploadMetadata, Album } from "./types";
import { Immutable } from "immer";

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
