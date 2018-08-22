export const ACTIONS = {
  ACTION_SET_STATE: "SET_STATE",
  ACTION_CLEAR_USER: "CLEAR_USER",
  ACTION_SET_TAGS: "SET_TAGS",
};

export const setState = (newState) => ({
  type: ACTIONS.ACTION_SET_STATE,
  newState,
});

export const setTags = (tags) => ({
  type: ACTIONS.ACTION_SET_TAGS,
  tags,
});
