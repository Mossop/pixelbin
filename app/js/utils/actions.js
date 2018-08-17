export const ACTIONS = {
  ACTION_SET_USER: "SET_USER",
  ACTION_CLEAR_USER: "CLEAR_USER",
};

export const setUser = (email, fullname) => ({
  type: ACTIONS.ACTION_SET_USER,
  email,
  fullname,
});

export const clearUser = () => ({
  type: ACTIONS.ACTION_CLEAR_USER,
});
