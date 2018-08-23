import { getRequest, postRequest } from "./api";

export async function upload(file, tags, date, gps) {
  let params = {
    file,
    tags,
    date: date.format("YYYY-MM-DDTHH:mm:ss"),
  };

  if (gps) {
    params.latitude = gps.latitude;
    params.longitude = gps.longitude;
  }

  let request = await postRequest("upload", params);

  if (request.ok) {
    return (await request.json()).tags;
  } else {
    throw new Error("Upload failed");
  }
}

export async function listMedia({ includeTags = [], includeType = "and", excludeTags = [] } = {}) {
  let params = new URLSearchParams();

  for (let tag of includeTags) {
    params.append("includeTag", tag);
  }

  for (let tag of excludeTags) {
    params.append("excludeTag", tag);
  }

  params.append("includeType", includeType);

  let request = await getRequest("listMedia", params);

  if (request.ok) {
    return (await request.json()).media;
  } else {
    throw new Error("Request failed");
  }
}
