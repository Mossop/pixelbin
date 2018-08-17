import { Map } from "immutable";

import { ACTIONS } from "./actions";

const reducers = {
  [ACTIONS.ACTION_SET_USER]: (state, { email, fullname }) => {
    return state.set("user", Map({ email, fullname }));
  },
};

export default (state, action) => {
  if (action.type in reducers) {
    return reducers[action.type](state, action);
  }

  return state;
};
