import { getRequest, postRequest, getAPIPath } from "./api";

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

  let request = await postRequest("upload", params);

  if (request.ok) {
    return (await request.json()).tags;
  } else {
    throw new Error("Upload failed");
  }
}

export async function listUntaggedMedia() {
  let request = await getRequest("listUntagged");

  if (request.ok) {
    return (await request.json()).media;
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

  let request = await getRequest("listMedia", params);

  if (request.ok) {
    return (await request.json()).media;
  } else {
    throw new Error("Request failed");
  }
}

export function buildThumbURL(id, size) {
  let url = getAPIPath(`media/${id}/thumbnail`);
  url.searchParams.append("size", size);
  return url;
}
