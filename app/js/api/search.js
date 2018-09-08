import { postRequest, getRequest, unpickle } from "./api";

export async function searchMedia({ includeTags = [], includeType = "and", excludeTags = [] } = {}) {
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
    return (await response.json()).media.map(unpickle);
  } else {
    throw new Error("Request failed");
  }
}

export async function saveSearch(includeTags, includeType = "and", excludeTags = []) {
  let params = new URLSearchParams();

  for (let tag of includeTags) {
    params.append("includeTag", tag.get("id"));
  }

  for (let tag of excludeTags) {
    params.append("excludeTag", tag.get("id"));
  }

  params.append("includeType", includeType);

  let response = await postRequest("saveSearch", params);

  if (response.ok) {
    return (await response.json()).searches;
  } else {
    throw new Error("Request failed");
  }
}

export async function fetchShare(id) {
  let response = await getRequest("share", {
    id,
  });

  if (response.ok) {
    let { name, media } = await response.json();
    return {
      name,
      media: media.map(unpickle),
    };
  } else {
    throw new Error("Request failed");
  }
}
