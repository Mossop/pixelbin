import { enableMapSet } from "immer";

import { fillMetadata } from "../../server/database";
import { Album } from "../api/highlevel";
import { mockStoreState, expect, mockUnprocessedMedia } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";
import { MediaLookupType } from "./types";

beforeAll(() => {
  enableMapSet();
});

test("listedMedia", (): void => {
  let state = mockStoreState({
    mediaList: {
      lookup: {
        type: MediaLookupType.Album,
        album: Album.ref("album1"),
        recursive: true,
      },
      media: null,
    },
  });

  let action = actions.listedMedia([]);
  let newState = reducer(state, action);

  expect(newState.mediaList).toEqual({
    lookup: {
      type: MediaLookupType.Album,
      album: expect.toBeRef("album1"),
      recursive: true,
    },
    media: [],
  });

  let media = mockUnprocessedMedia({
    id: "testmedia",
    albums: [
      Album.ref("testing"),
    ],
  });

  action = actions.listedMedia([media]);
  newState = reducer(state, action);

  expect(newState.mediaList).toEqual({
    lookup: {
      type: MediaLookupType.Album,
      album: expect.toBeRef("album1"),
      recursive: true,
    },
    media: [fillMetadata({
      id: "testmedia",
      created: expect.anything(),
      albums: [
        expect.toBeRef("testing"),
      ],
      tags: [],
      people: [],
    })],
  });
});
