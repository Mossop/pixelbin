import { Catalog, Album } from "../api/highlevel";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import { mockStoreState, expect, mapOf, mockServerState } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

test("showAlbumCreateOverlay", (): void => {
  let state = mockStoreState({
    serverState: mockServerState([{
      id: "cat1",
      name: "Catalog 1",
      albums: [{
        id: "album1",
        name: "Album 1",
      }],
    }]),
  });

  expect(state.ui).toEqual({
    page: {
      type: PageType.Index,
    },
  });

  let action = actions.showAlbumCreateOverlay(Catalog.ref("cat1"));
  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Index,
    },
    overlay: {
      type: OverlayType.CreateAlbum,
      parent: expect.toBeRef("cat1"),
    },
  });

  action = actions.showAlbumCreateOverlay(Album.ref("album1"));
  newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Index,
    },
    overlay: {
      type: OverlayType.CreateAlbum,
      parent: expect.toBeRef("album1"),
    },
  });
});

test("showAlbumEditOverlay", (): void => {
  let state = mockStoreState({
    serverState: mockServerState([{
      id: "cat1",
      name: "Catalog 1",
      albums: [{
        id: "album1",
        name: "Album 1",
      }],
    }]),
  });

  expect(state.ui).toEqual({
    page: {
      type: PageType.Index,
    },
  });

  let action = actions.showAlbumEditOverlay(Album.ref("album1"));
  let newState = reducer(state, action);

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Index,
    },
    overlay: {
      type: OverlayType.EditAlbum,
      album: expect.toBeRef("album1"),
    },
  });
});

test("albumCreated", (): void => {
  let state = mockStoreState({
    serverState: mockServerState([{
      id: "cat1",
      name: "Catalog 1",
      storage: "mystore",
      albums: [{
        id: "album1",
        name: "Album 1",
      }],
    }]),
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.CreateAlbum,
        parent: Catalog.ref("cat1"),
      },
    },
  });

  expect(state.serverState.user).toEqual({
    catalogs: mapOf({
      cat1: {
        id: "cat1",
        name: "Catalog 1",
        storage: "mystore",
        tags: mapOf({}),
        people: mapOf({}),
        albums: mapOf({
          album1: {
            catalog: expect.toBeRef("cat1"),
            id: "album1",
            name: "Album 1",
            parent: null,
          },
        }),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        endpoint: null,
        id: "mystore",
        name: "Test store",
        path: null,
        publicUrl: null,
      },
    }),
    verified: true,
  });

  let action = actions.albumCreated({
    id: "album2",
    name: "My new album",
    parent: null,
    catalog: Catalog.ref("cat1"),
  });

  let newState = reducer(state, action);

  expect(newState.serverState.user?.catalogs).toEqual(mapOf({
    cat1: {
      id: "cat1",
      name: "Catalog 1",
      storage: "mystore",
      tags: mapOf({}),
      people: mapOf({}),
      albums: mapOf({
        album1: {
          catalog: expect.toBeRef("cat1"),
          id: "album1",
          name: "Album 1",
          parent: null,
        },
        album2: {
          catalog: expect.toBeRef("cat1"),
          id: "album2",
          name: "My new album",
          parent: null,
        },
      }),
    },
  }));

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: expect.toBeRef("album2"),
    },
  });
});

test("Album edited", (): void => {
  let state = mockStoreState({
    serverState: mockServerState([{
      id: "cat1",
      name: "Catalog 1",
      storage: "mystore",
      albums: [{
        id: "album1",
        name: "Album 1",
      }],
    }]),
    ui: {
      page: {
        type: PageType.Index,
      },
      overlay: {
        type: OverlayType.EditAlbum,
        album: Album.ref("album1"),
      },
    },
  });

  expect(state.serverState.user).toEqual({
    catalogs: mapOf({
      cat1: {
        id: "cat1",
        name: "Catalog 1",
        storage: "mystore",
        tags: mapOf({}),
        people: mapOf({}),
        albums: mapOf({
          album1: {
            catalog: expect.toBeRef("cat1"),
            id: "album1",
            name: "Album 1",
            parent: null,
          },
        }),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        endpoint: null,
        id: "mystore",
        name: "Test store",
        path: null,
        publicUrl: null,
      },
    }),
    verified: true,
  });

  let action = actions.albumEdited({
    id: "album1",
    name: "Renamed album",
    parent: null,
    catalog: Catalog.ref("cat1"),
  });

  let newState = reducer(state, action);

  expect(newState.serverState.user?.catalogs).toEqual(mapOf({
    cat1:
    {
      id: "cat1",
      name: "Catalog 1",
      storage: "mystore",
      tags: mapOf({}),
      people: mapOf({}),
      albums: mapOf({
        album1: {
          catalog: expect.toBeRef("cat1"),
          id: "album1",
          name: "Renamed album",
          parent: null,
        },
      }),
    },
  }));

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Index,
    },
  });
});
