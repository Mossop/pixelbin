export const ACTIONS = {
  ACTION_SET_STATE: "SET_STATE",
  ACTION_SET_TAGS: "SET_TAGS",
  ACTION_SET_SEARCHES: "SET_SEARCHES",
};

export const setState = (newState) => ({
  type: ACTIONS.ACTION_SET_STATE,
  newState,
});

export const setTags = (tags) => ({
  type: ACTIONS.ACTION_SET_TAGS,
  tags,
});

export const setSearches = (searches) => ({
  type: ACTIONS.ACTION_SET_SEARCHES,
  searches,
});
