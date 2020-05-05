import { Album } from "../api/highlevel";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import { mockStore, expect } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

test("Navigate", (): void => {
  let state = mockStore({
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
    overlay: {
      type: OverlayType.Upload,
    },
  });

  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testalbum"),
    },
    overlay: {
      type: OverlayType.Upload,
    },
  });
});
