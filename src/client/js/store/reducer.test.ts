import { Album } from "../api/highlevel";
import { PageType } from "../pages/types";
import { mockStoreState, expect } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

test("Navigate", (): void => {
  let state = mockStoreState({
    serverState: { user: null },
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  });

  let action = actions.navigate({
    page: {
      type: PageType.Album,
      album: Album.ref("testalbum"),
    },
  });

  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testalbum"),
    },
  });
});
