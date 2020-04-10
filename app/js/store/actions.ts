import { actionCreators } from "deeds/immer";

import type { reducers } from "./reducer";

export default actionCreators<typeof reducers>();
