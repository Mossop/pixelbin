import { fromJS } from "immutable";

import { ACTIONS } from "./actions";

const reducers = {
  [ACTIONS.ACTION_SET_STATE]: (state, { newState }) => {
    return fromJS(newState);
  },
  [ACTIONS.ACTION_SET_TAGS]: (state, { tags }) => {
    return state.set("tags", fromJS(tags));
  },
};

export default (state, action) => {
  if (action.type in reducers) {
    return reducers[action.type](state, action);
  }

  return state;
};
