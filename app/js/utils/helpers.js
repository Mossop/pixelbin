export const loggedIn = (state) => state.get("user", null) != null;

export const bindAll = (obj, keys) => {
  for (let key of keys) {
    obj[key] = obj[key].bind(obj);
  }
};

export const tagIDFromPath = (state, path) => {
  const findTagId = (tagList, tagPath) => {
    let first = tagPath.shift();
    let tag = tagList.find(t => t.get("name") == first);
    if (tag) {
      if (tagPath.length) {
        return findTagId(tag.get("children"), tagPath);
      } else {
        return tag.get("id");
      }
    } else {
      return null;
    }
  };

  let tags = path.split("/");

  return findTagId(state.get("tags"), tags);
};

export function drawBitmapToCanvas(bitmap, canvas) {
  let size = canvas.height;
  let width = bitmap.width;
  let height = bitmap.height;
  if (width > height) {
    width = size;
    height = bitmap.height / (bitmap.width / width);
  } else {
    height = size;
    width = bitmap.width / (bitmap.height / height);
  }

  let context = canvas.getContext("2d");
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
}
