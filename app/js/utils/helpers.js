export const loggedIn = (state) => state.get("user", null) != null;
export const bindAll = (obj, keys) => {
  for (let key of keys) {
    obj[key] = obj[key].bind(obj);
  }
};
