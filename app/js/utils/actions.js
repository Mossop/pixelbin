export const ACTIONS = {
  ACTION_SET_USER: "SET_USER",
};

export const setUser = (email, fullname) => ({
  type: ACTIONS.ACTION_SET_USER,
  email,
  fullname,
});
