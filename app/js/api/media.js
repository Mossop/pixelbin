import { getRequest, postRequest, getAPIPath, unpickle } from "./api";

export async function upload(file, metadata, additionalTags = "") {
  let params = {
    file,
    tags: metadata.tags + ", " + additionalTags,
    date: metadata.date.format("YYYY-MM-DDTHH:mm:ss"),
  };

  if (metadata.latitude && metadata.longitude) {
    params.latitude = metadata.latitude;
    params.longitude = metadata.longitude;
  }

  let response = await postRequest("upload", params);

  if (response.ok) {
    return (await response.json()).tags;
  } else {
    throw new Error("Upload failed");
  }
}

export async function listUntaggedMedia() {
  let response = await getRequest("listUntagged");

  if (response.ok) {
    return (await response.json()).media.map(unpickle);
  } else {
    throw new Error("Request failed");
  }
}

export function buildThumbURL(media, size) {
  let url = getAPIPath(`media/${media.id}/thumbnail`);
  url.searchParams.append("size", size);
  return url;
}

export function buildDownloadURL(media) {
  return getAPIPath(`media/${media.id}/download`);
}

export async function loadMetadata(id) {
  let response = await getRequest(`media/${id}`);

  if (response.ok) {
    return unpickle(await response.json());
  } else {
    throw new Error("Request failed");
  }
}

export async function loadBitmap(id) {
  let response = await getRequest(`media/${id}/download`);

  if (response.ok) {
    return createImageBitmap(await response.blob());
  } else {
    throw new Error("Request failed");
  }
}
