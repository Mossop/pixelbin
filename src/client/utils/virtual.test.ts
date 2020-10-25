import { Catalog, catalogs } from "../api/highlevel";
import { mockServerState, mockStore, mockStoreState } from "../test-helpers/store";
import {
  VirtualItem,
  VirtualTree,
  VirtualTreeOptions,
  IncludeVirtualCategories,
  filtered,
} from "./virtual";

interface ItemInfo {
  id: string;
  children: ItemInfo[];
}

function iterateVirtualItem(item: VirtualItem): ItemInfo {
  return {
    id: item.id,
    children: item.children.map(iterateVirtualItem),
  };
}

function buildList(items: Catalog[], options?: VirtualTreeOptions): ItemInfo[] {
  return items.map((catalog: Catalog): ItemInfo => {
    return iterateVirtualItem(catalog.virtual(options));
  });
}

test("virtual iteration", async (): Promise<void> => {
  let store = mockStore(mockStoreState({
    serverState: mockServerState([{
      id: "catalog1",
      name: "Catalog 1",
      albums: [{
        id: "album1",
        name: "Album 1",
        children: [{
          id: "album2",
          name: "Album 2",
        }],
      }],
      tags: [{
        id: "tag1",
        name: "Tag 1",
        children: [{
          id: "tag2",
          name: "Tag 2",
        }],
      }],
      people: [{
        id: "dave",
        name: "Dave",
      }, {
        id: "bob",
        name: "Bob",
      }],
    }, {
      id: "catalog2",
      name: "Catalog 2",
      albums: [{
        id: "album3",
        name: "Album 3",
      }],
      tags: [{
        id: "tag3",
        name: "Tag 3",
        children: [{
          id: "tag4",
          name: "Tag 4",
        }, {
          id: "tag5",
          name: "Tag 5",
        }],
      }],
    }]),
  }));

  let roots = catalogs(store.state.serverState);

  expect(buildList(roots)).toEqual([{
    id: "catalog1",
    children: [{
      id: "albumlist",
      children: [{
        id: "album1",
        children: [{
          id: "album2",
          children: [],
        }],
      }],
    }, {
      id: "taglist",
      children: [{
        id: "tag1",
        children: [{
          id: "tag2",
          children: [],
        }],
      }],
    }, {
      id: "personlist",
      children: [{
        id: "dave",
        children: [],
      }, {
        id: "bob",
        children: [],
      }],
    }],
  }, {
    id: "catalog2",
    children: [{
      id: "albumlist",
      children: [{
        id: "album3",
        children: [],
      }],
    }, {
      id: "taglist",
      children: [{
        id: "tag3",
        children: [{
          id: "tag4",
          children: [],
        }, {
          id: "tag5",
          children: [],
        }],
      }],
    }, {
      id: "personlist",
      children: [],
    }],
  }]);

  expect(buildList(roots, filtered(VirtualTree.All, (item: VirtualItem): boolean => {
    return item.id != "tag3";
  }))).toEqual([{
    id: "catalog1",
    children: [{
      id: "albumlist",
      children: [{
        id: "album1",
        children: [{
          id: "album2",
          children: [],
        }],
      }],
    }, {
      id: "taglist",
      children: [{
        id: "tag1",
        children: [{
          id: "tag2",
          children: [],
        }],
      }],
    }, {
      id: "personlist",
      children: [{
        id: "dave",
        children: [],
      }, {
        id: "bob",
        children: [],
      }],
    }],
  }, {
    id: "catalog2",
    children: [{
      id: "albumlist",
      children: [{
        id: "album3",
        children: [],
      }],
    }, {
      id: "taglist",
      children: [],
    }, {
      id: "personlist",
      children: [],
    }],
  }]);

  expect(buildList(roots, VirtualTree.Albums)).toEqual([{
    id: "catalog1",
    children: [{
      id: "album1",
      children: [{
        id: "album2",
        children: [],
      }],
    }],
  }, {
    id: "catalog2",
    children: [{
      id: "album3",
      children: [],
    }],
  }]);

  expect(buildList(roots, {
    ...VirtualTree.Albums,
    categories: IncludeVirtualCategories.IfNotEmpty,
  })).toEqual([{
    id: "catalog1",
    children: [{
      id: "albumlist",
      children: [{
        id: "album1",
        children: [{
          id: "album2",
          children: [],
        }],
      }],
    }],
  }, {
    id: "catalog2",
    children: [{
      id: "albumlist",
      children: [{
        id: "album3",
        children: [],
      }],
    }],
  }]);

  expect(buildList(roots, VirtualTree.People)).toEqual([{
    id: "catalog1",
    children: [{
      id: "dave",
      children: [],
    }, {
      id: "bob",
      children: [],
    }],
  }, {
    id: "catalog2",
    children: [],
  }]);

  expect(buildList(roots, {
    ...VirtualTree.People,
    categories: IncludeVirtualCategories.IfNotEmpty,
  })).toEqual([{
    id: "catalog1",
    children: [{
      id: "personlist",
      children: [{
        id: "dave",
        children: [],
      }, {
        id: "bob",
        children: [],
      }],
    }],
  }, {
    id: "catalog2",
    children: [],
  }]);
});
