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
