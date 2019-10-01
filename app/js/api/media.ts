import { getRequest, postRequest, getAPIPath } from "./api";
import { UploadResponseDecoder, Media, UploadMetadata, MediaDecoder, MediaArrayDecoder, Tag } from "../types";

export async function upload(file: string, metadata: UploadMetadata, additionalTags: string = ""): Promise<Tag[]> {
  let params = new URLSearchParams();
  params.set("file", file);
  params.set("tags", metadata.tags + ", " + additionalTags);
  params.set("date", metadata.taken.format("YYYY-MM-DDTHH:mm:ss"));

  if (metadata.latitude && metadata.longitude) {
    params.set("latitude", String(metadata.latitude));
    params.set("longitude", String(metadata.longitude));
  }

  let response = await postRequest("upload", params);

  if (response.ok) {
    return (await UploadResponseDecoder.decodePromise(await response.json())).tags;
  } else {
    throw new Error("Upload failed");
  }
}

export async function listUntagged(): Promise<Media[]> {
  let response = await getRequest("listUntagged");

  if (response.ok) {
    return await MediaArrayDecoder.decodePromise((await response.json()).media);
  } else {
    throw new Error("Request failed");
  }
}

export function buildThumbURL(media: Media, size: number): URL {
  let url = getAPIPath(`media/${media.id}/thumbnail`);
  url.searchParams.append("size", String(size));
  return url;
}

export function buildDownloadURL(media: Media): URL {
  let url = getAPIPath(`media/${media.id}/download`);
  return url;
}

export async function loadMetadata(id: number): Promise<Media> {
  let response = await getRequest(`media/${id}`);

  if (response.ok) {
    return MediaDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Request failed");
  }
}

export async function loadBitmap(id: number): Promise<ImageBitmap> {
  let response = await getRequest(`media/${id}/download`);

  if (response.ok) {
    return createImageBitmap(await response.blob());
  } else {
    throw new Error("Request failed");
  }
}
