import { enableMapSet } from "immer";

import { Catalog, Album } from "../api/highlevel";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import { mockStoreState, expect, mapOf, mockServerState } from "../test-helpers";
import actions from "./actions";
import reducer from "./reducer";

beforeAll(() => {
  enableMapSet();
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
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.AlbumCreate,
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
        searches: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        region: "test-region-001",
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
      searches: mapOf({}),
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
        type: PageType.Root,
      },
      overlay: {
        type: OverlayType.AlbumEdit,
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
        searches: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        region: "test-region-001",
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
      searches: mapOf({}),
    },
  }));

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Root,
    },
  });
});

test("Album deleted", (): void => {
  let state = mockStoreState({
    serverState: mockServerState([{
      id: "cat1",
      name: "Catalog 1",
      storage: "mystore",
      albums: [{
        id: "album1",
        name: "Album 1",
        children: [{
          id: "album2",
          name: "Album 2",
          children: [{
            id: "album9",
            name: "Album 9",
          }],
        }, {
          id: "album3",
          name: "Album 3",
        }, {
          id: "album4",
          name: "Album 4",
        }, {
          id: "album5",
          name: "Album 5",
        }],
      }, {
        id: "album6",
        name: "Album 6",
        children: [{
          id: "album7",
          name: "Album 7",
        }, {
          id: "album8",
          name: "Album 8",
        }],
      }],
    }]),
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("album3"),
      },
      overlay: {
        type: OverlayType.AlbumDelete,
        album: Album.ref("album3"),
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
          album2: {
            catalog: expect.toBeRef("cat1"),
            id: "album2",
            name: "Album 2",
            parent: expect.toBeRef("album1"),
          },
          album3: {
            catalog: expect.toBeRef("cat1"),
            id: "album3",
            name: "Album 3",
            parent: expect.toBeRef("album1"),
          },
          album4: {
            catalog: expect.toBeRef("cat1"),
            id: "album4",
            name: "Album 4",
            parent: expect.toBeRef("album1"),
          },
          album5: {
            catalog: expect.toBeRef("cat1"),
            id: "album5",
            name: "Album 5",
            parent: expect.toBeRef("album1"),
          },
          album6: {
            catalog: expect.toBeRef("cat1"),
            id: "album6",
            name: "Album 6",
            parent: null,
          },
          album7: {
            catalog: expect.toBeRef("cat1"),
            id: "album7",
            name: "Album 7",
            parent: expect.toBeRef("album6"),
          },
          album8: {
            catalog: expect.toBeRef("cat1"),
            id: "album8",
            name: "Album 8",
            parent: expect.toBeRef("album6"),
          },
          album9: {
            catalog: expect.toBeRef("cat1"),
            id: "album9",
            name: "Album 9",
            parent: expect.toBeRef("album2"),
          },
        }),
        searches: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        region: "test-region-001",
        endpoint: null,
        id: "mystore",
        name: "Test store",
        path: null,
        publicUrl: null,
      },
    }),
    verified: true,
  });

  expect(state.ui).toEqual({
    page: {
      type: PageType.Album,
      album: Album.ref("album3"),
    },
    overlay: {
      type: OverlayType.AlbumDelete,
      album: Album.ref("album3"),
    },
  });

  let action = actions.albumDeleted(Album.ref("album3"));

  let newState = reducer(state, action);

  expect(newState.serverState.user).toEqual({
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
          album2: {
            catalog: expect.toBeRef("cat1"),
            id: "album2",
            name: "Album 2",
            parent: expect.toBeRef("album1"),
          },
          album4: {
            catalog: expect.toBeRef("cat1"),
            id: "album4",
            name: "Album 4",
            parent: expect.toBeRef("album1"),
          },
          album5: {
            catalog: expect.toBeRef("cat1"),
            id: "album5",
            name: "Album 5",
            parent: expect.toBeRef("album1"),
          },
          album6: {
            catalog: expect.toBeRef("cat1"),
            id: "album6",
            name: "Album 6",
            parent: null,
          },
          album7: {
            catalog: expect.toBeRef("cat1"),
            id: "album7",
            name: "Album 7",
            parent: expect.toBeRef("album6"),
          },
          album8: {
            catalog: expect.toBeRef("cat1"),
            id: "album8",
            name: "Album 8",
            parent: expect.toBeRef("album6"),
          },
          album9: {
            catalog: expect.toBeRef("cat1"),
            id: "album9",
            name: "Album 9",
            parent: expect.toBeRef("album2"),
          },
        }),
        searches: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        region: "test-region-001",
        endpoint: null,
        id: "mystore",
        name: "Test store",
        path: null,
        publicUrl: null,
      },
    }),
    verified: true,
  });

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Album,
      album: Album.ref("album1"),
    },
  });

  // @ts-ignore: Draft crap.
  state = {
    ...newState,
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("album6"),
      },
      overlay: {
        type: OverlayType.AlbumDelete,
        album: Album.ref("album6"),
      },
    },
  };

  action = actions.albumDeleted(Album.ref("album6"));

  newState = reducer(state, action);

  expect(newState.serverState.user).toEqual({
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
          album2: {
            catalog: expect.toBeRef("cat1"),
            id: "album2",
            name: "Album 2",
            parent: expect.toBeRef("album1"),
          },
          album4: {
            catalog: expect.toBeRef("cat1"),
            id: "album4",
            name: "Album 4",
            parent: expect.toBeRef("album1"),
          },
          album5: {
            catalog: expect.toBeRef("cat1"),
            id: "album5",
            name: "Album 5",
            parent: expect.toBeRef("album1"),
          },
          album9: {
            catalog: expect.toBeRef("cat1"),
            id: "album9",
            name: "Album 9",
            parent: expect.toBeRef("album2"),
          },
        }),
        searches: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        region: "test-region-001",
        endpoint: null,
        id: "mystore",
        name: "Test store",
        path: null,
        publicUrl: null,
      },
    }),
    verified: true,
  });

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Catalog,
      catalog: Catalog.ref("cat1"),
    },
  });

  // @ts-ignore: Draft crap.
  state = {
    ...newState,
    ui: {
      page: {
        type: PageType.Album,
        album: Album.ref("album9"),
      },
      overlay: {
        type: OverlayType.AlbumDelete,
        album: Album.ref("album1"),
      },
    },
  };

  action = actions.albumDeleted(Album.ref("album1"));

  newState = reducer(state, action);

  expect(newState.serverState.user).toEqual({
    catalogs: mapOf({
      cat1: {
        id: "cat1",
        name: "Catalog 1",
        storage: "mystore",
        tags: mapOf({}),
        people: mapOf({}),
        albums: mapOf({}),
        searches: mapOf({}),
      },
    }),
    created: "2020-04-05T12:34:45Z",
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    storage: mapOf({
      mystore: {
        bucket: "test-bucket",
        region: "test-region-001",
        endpoint: null,
        id: "mystore",
        name: "Test store",
        path: null,
        publicUrl: null,
      },
    }),
    verified: true,
  });

  expect(newState.ui).toEqual({
    page: {
      type: PageType.Catalog,
      catalog: Catalog.ref("cat1"),
    },
  });
});
