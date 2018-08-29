import { getRequest, postRequest, getAPIPath } from "./api";

export async function upload(file, metadata, additionalTags = "") {
  let params = {
    file,
    tags: metadata.tags + ", " + additionalTags,
    date: metadata.date.format("YYYY-MM-DDTHH:mm:ss"),
    width: metadata.width,
    height: metadata.height,
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
    return (await response.json()).media;
  } else {
    throw new Error("Request failed");
  }
}

export async function listMedia({ includeTags = [], includeType = "and", excludeTags = [] } = {}) {
  let params = new URLSearchParams();

  for (let tag of includeTags) {
    params.append("includeTag", tag.get("id"));
  }

  for (let tag of excludeTags) {
    params.append("excludeTag", tag.get("id"));
  }

  params.append("includeType", includeType);

  let response = await getRequest("listMedia", params);

  if (response.ok) {
    return (await response.json()).media;
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
    return response.json();
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
