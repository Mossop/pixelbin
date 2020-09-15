import { fillMetadata } from "../../server/database";
import { Album } from "../api/highlevel";
import { PageType } from "../pages/types";
import { mockStoreState, expect, mockUnprocessedMedia } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

test("listedMedia", (): void => {
  let state = mockStoreState({
    ui: {
      page: {
        type: PageType.Index,
      },
    },
  });

  let action = actions.listedMedia([]);
  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Index,
    },
  });

  state = mockStoreState({
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("testing"),
      },
    },
  });

  newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testing"),
      media: [],
    },
  });

  let media = mockUnprocessedMedia({
    id: "testmedia",
    albums: [
      Album.ref("testing"),
    ],
  });

  action = actions.listedMedia([media]);
  newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("testing"),
      media: [fillMetadata({
        id: "testmedia",
        created: expect.anything(),
        albums: [
          expect.toBeRef("testing"),
        ],
        tags: [],
        people: [],
      })],
    },
  });
});
