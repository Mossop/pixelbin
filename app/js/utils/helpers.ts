export const loggedIn = (state) => state.get("user", null) != null;

export const bindAll = (obj, keys) => {
  for (let key of keys) {
    obj[key] = obj[key].bind(obj);
  }
};

export const tagIDFromPath = (state, path) => {
  let tag = tagFromPath(state, path);
  if (tag) {
    return tag.get("id");
  }
  return null;
};

export const tagFromPath = (state, path) => {
  const findTag = (tagList, tagPath) => {
    let first = tagPath.shift();
    let tag = tagList.find(t => t.get("name") == first);
    if (tag) {
      if (tagPath.length) {
        return findTag(tag.get("children"), tagPath);
      } else {
        return tag;
      }
    } else {
      return null;
    }
  };

  let tags = path.split("/");

  return findTag(state.get("tags"), tags);
};

export const uuid = () => {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

export function deepEqual(a, b) {
  if (a === null && b === null) {
    return true;
  }

  if (a === undefined && b === undefined) {
    return true;
  }

  if (a === null || a === undefined) {
    return false;
  }

  if (b === null || b === undefined) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length != b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }

    return true;
  } else if (typeof(a) == "object" && typeof(b) == "object") {
    let aKeys = Object.keys(a);
    let bKeys = Object.keys(b);
    if (aKeys.length != bKeys.length) {
      return false;
    }

    for (let key of aKeys) {
      if (!bKeys.includes(key)) {
        return false;
      }

      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }

    for (let key of bKeys) {
      if (!aKeys.includes(key)) {
        return false;
      }
    }

    return true;
  } else {
    return a === b;
  }
}
