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

export async function fetchTagSearch(id) {
  let response = await getRequest("tagSearch", {
    id,
  });

  if (response.ok) {
    return response.json();
  } else {
    throw new Error("Request failed");
  }
}
