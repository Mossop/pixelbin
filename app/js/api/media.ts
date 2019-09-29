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

export function buildThumbURL(media, size, share = null) {
  let url = getAPIPath(`media/${media.id}/thumbnail`);
  url.searchParams.append("size", size);
  if (share) {
    url.searchParams.append("share", share);
  }
  return url;
}

export function buildDownloadURL(media, share = null) {
  let url = getAPIPath(`media/${media.id}/download`);
  if (share) {
    url.searchParams.append("share", share);
  }
  return url;
}

export async function loadMetadata(id, share = null) {
  let params = {};
  if (share) {
    params["share"] = share;
  }
  let response = await getRequest(`media/${id}`, params);

  if (response.ok) {
    return unpickle(await response.json());
  } else {
    throw new Error("Request failed");
  }
}

export async function loadBitmap(id, share = null) {
  let params = {};
  if (share) {
    params["share"] = share;
  }
  let response = await getRequest(`media/${id}/download`, params);

  if (response.ok) {
    return createImageBitmap(await response.blob());
  } else {
    throw new Error("Request failed");
  }
}
