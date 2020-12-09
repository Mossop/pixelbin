import { mockServerState, expect, fixedState } from "../test-helpers";
import { ErrorCode } from "../utils/exception";
import { nameSorted } from "../utils/sort";
import {
  catalogs,
  Catalog,
  Album,
  Tag,
  Person,
  dereferencer,
  PendingAPIItem,
  SavedSearch,
} from "./highlevel";
import type { ServerState } from "./types";

const LoggedOut: ServerState = {
  user: null,
  ...fixedState,
};

const LoggedIn = mockServerState([{
  id: "testcatalog1",
  name: "Test catalog 1",
  albums: [{
    id: "testalbum1",
    name: "Test album 1",
    children: [{
      id: "childalbum1",
      name: "Child album 1",
    }, {
      id: "childalbum2",
      name: "Child album 2",
    }],
  }],
  tags: [{
    id: "testtag1",
    name: "Test tag 1",
    children: [{
      id: "childtag1",
      name: "Child tag 1",
    }],
  }],
  people: [{
    id: "testperson1",
    name: "Test person 1",
  }],
  searches: [{
    id: "search1",
    name: "my search",
  }, {
    id: "search2",
    name: "my other search",
  }],
}, {
  id: "testcatalog2",
  name: "Test catalog 2",
}]);

const Mutated = mockServerState([{
  id: "testcatalog1",
  name: "Test catalog 1",
  albums: [{
    id: "testalbum1",
    name: "Test album 1",
    children: [{
      id: "childalbum2",
      name: "Child album 2",
    }],
  }, {
    id: "childalbum1",
    name: "Child album 1",
  }],
  tags: [{
    id: "testtag1",
    name: "Test tag 1",
    children: [{
      id: "childtag2",
      name: "Child tag 2",
    }],
  }],
  people: [{
    id: "testperson1",
    name: "Test person 1",
  }],
  searches: [{
    id: "search1",
    name: "my search",
  }],
}, {
  id: "testcatalog2",
  name: "Test catalog 2",
}]);

test("Catalog structures.", (): void => {
  let cats = catalogs(LoggedOut);
  expect(cats).toHaveLength(0);

  expect((): void => {
    Catalog.fromState(LoggedOut, "testcatalog1");
  }).toThrowAppError(ErrorCode.NotLoggedIn);
  expect(Catalog.safeFromState(LoggedOut, "testcatalog1")).toBeUndefined();

  let catref = Catalog.ref("testcatalog1");
  expect((): void => {
    catref.deref(LoggedOut);
  }).toThrowAppError(ErrorCode.NotLoggedIn);

  expect((): void => {
    Catalog.fromState(LoggedIn, "catalog5");
  }).toThrowAppError(ErrorCode.UnknownCatalog);

  cats = nameSorted(catalogs(LoggedIn));
  expect(cats).toHaveLength(2);

  expect(cats[0].id).toBe("testcatalog1");
  expect(cats[0].name).toBe("Test catalog 1");
  expect(cats[1].id).toBe("testcatalog2");
  expect(cats[1].name).toBe("Test catalog 2");

  expect(catref.deref(LoggedIn)).toBe(cats[0]);
  expect(Catalog.fromState(LoggedIn, "testcatalog1")).toBe(cats[0]);
  expect(cats[0].ref().deref(LoggedIn)).toBe(cats[0]);

  expect(cats[0].albums).toHaveLength(3);
  expect(cats[0].people).toHaveLength(1);
  expect(cats[0].tags).toHaveLength(2);
  expect(cats[0].searches).toHaveLength(2);
  expect(cats[1].albums).toHaveLength(0);
  expect(cats[1].people).toHaveLength(0);
  expect(cats[1].tags).toHaveLength(0);
  expect(cats[1].searches).toHaveLength(0);

  let mutated = cats[0].ref().deref(Mutated);
  expect(mutated).not.toBe(cats[0]);
  expect(mutated.id).toBe("testcatalog1");
  expect(mutated.name).toBe("Test catalog 1");
  expect(mutated.rootAlbums).toHaveLength(2);

  expect(cats[1].getAlbum("testalbum1")).toBeUndefined();
});

test("Album structures.", (): void => {
  expect((): void => {
    Album.fromState(LoggedOut, "testalbum1");
  }).toThrowAppError(ErrorCode.NotLoggedIn);

  expect((): void => {
    Album.fromState(LoggedIn, "testalbum5");
  }).toThrowAppError(ErrorCode.UnknownAlbum);

  let catalog = Catalog.fromState(LoggedIn, "testcatalog1");

  let roots = catalog.rootAlbums;
  expect(roots).toHaveLength(1);
  expect(roots[0].id).toBe("testalbum1");
  expect(roots[0].catalog).toBe(catalog);
  expect(roots[0].name).toBe("Test album 1");
  expect(roots[0].parent).toBeUndefined();

  expect(catalog.rootAlbums[0]).toBe(roots[0]);

  expect(catalog.getAlbum("testalbum1")).toBe(roots[0]);
  expect(catalog.getAlbum("testalbum5")).toBeUndefined();

  expect(Album.ref("testalbum1").deref(LoggedIn)).toBe(roots[0]);

  let children = nameSorted(roots[0].children);
  expect(children).toHaveLength(2);

  expect(children[0].id).toBe("childalbum1");
  expect(children[0].catalog).toBe(catalog);
  expect(children[0].name).toBe("Child album 1");
  expect(children[0].parent).toBe(roots[0]);
  expect(children[0].children).toHaveLength(0);
  expect(children[1].id).toBe("childalbum2");
  expect(children[1].catalog).toBe(catalog);
  expect(children[1].name).toBe("Child album 2");
  expect(children[1].parent).toBe(roots[0]);
  expect(children[1].children).toHaveLength(0);

  expect(roots[0].isAncestorOf(roots[0])).toBeFalsy();
  expect(roots[0].isAncestorOf(children[0])).toBeTruthy();
  expect(roots[0].isAncestorOf(children[1])).toBeTruthy();
  expect(children[0].isAncestorOf(roots[0])).toBeFalsy();
  expect(children[1].isAncestorOf(roots[0])).toBeFalsy();
  expect(children[0].isAncestorOf(children[1])).toBeFalsy();
  expect(children[1].isAncestorOf(children[0])).toBeFalsy();

  expect(children[0].ref().deref(LoggedIn)).toBe(children[0]);

  let mutated = children[0].ref().deref(Mutated);
  expect(mutated).not.toBe(children[0]);
  expect(mutated.parent).toBeUndefined();
});

test("Tag structures.", (): void => {
  expect((): void => {
    Tag.fromState(LoggedOut, "testtag1");
  }).toThrowAppError(ErrorCode.NotLoggedIn);
  expect(Tag.safeFromState(LoggedOut, "foobar")).toBeUndefined();

  expect((): void => {
    Tag.fromState(LoggedIn, "testtag5");
  }).toThrowAppError(ErrorCode.UnknownTag);
  expect(Tag.safeFromState(LoggedIn, "foobar")).toBeUndefined();

  let catalog = Catalog.fromState(LoggedIn, "testcatalog1");

  let roots = catalog.rootTags;
  expect(roots).toHaveLength(1);
  expect(roots[0].id).toBe("testtag1");
  expect(roots[0].catalog).toBe(catalog);
  expect(roots[0].name).toBe("Test tag 1");
  expect(roots[0].parent).toBeUndefined();

  expect(catalog.rootTags[0]).toBe(roots[0]);

  expect(Tag.ref("testtag1").deref(LoggedIn)).toBe(roots[0]);

  let children = nameSorted(roots[0].children);
  expect(children).toHaveLength(1);

  expect(children[0].id).toBe("childtag1");
  expect(children[0].catalog).toBe(catalog);
  expect(children[0].name).toBe("Child tag 1");
  expect(children[0].parent).toBe(roots[0]);
  expect(children[0].children).toHaveLength(0);

  expect(children[0].ref().deref(LoggedIn)).toBe(children[0]);

  let mutated = roots[0].ref().deref(Mutated);
  expect(mutated).not.toBe(roots[0]);
  expect(mutated.parent).toBeUndefined();
});

test("Person structures.", (): void => {
  expect((): void => {
    Person.fromState(LoggedOut, "testperson1");
  }).toThrowAppError(ErrorCode.NotLoggedIn);
  expect(Person.safeFromState(LoggedOut, "testperson1")).toBeUndefined();

  expect((): void => {
    Person.fromState(LoggedIn, "testperson5");
  }).toThrowAppError(ErrorCode.UnknownPerson);
  expect(Person.safeFromState(LoggedIn, "testperson5")).toBeUndefined();

  let catalog = Catalog.fromState(LoggedIn, "testcatalog1");

  let people = catalog.people;
  expect(people).toHaveLength(1);
  expect(people[0].id).toBe("testperson1");
  expect(people[0].name).toBe("Test person 1");
  expect(people[0].catalog).toBe(catalog);

  expect(Person.ref("testperson1").deref(LoggedIn)).toBe(people[0]);

  expect(people[0].ref().deref(LoggedIn)).toBe(people[0]);

  let mutated = people[0].ref().deref(Mutated);
  expect(mutated).not.toBe(people[0]);
});

test("Search structures.", (): void => {
  expect((): void => {
    SavedSearch.fromState(LoggedOut, "search1");
  }).toThrowAppError(ErrorCode.NotLoggedIn);
  expect(SavedSearch.safeFromState(LoggedOut, "search1")).toBeUndefined();

  expect((): void => {
    SavedSearch.fromState(LoggedIn, "searchs2");
  }).toThrowAppError(ErrorCode.UnknownSearch);
  expect(SavedSearch.safeFromState(LoggedIn, "searchs2")).toBeUndefined();

  let catalog = Catalog.fromState(LoggedIn, "testcatalog1");

  let searches = catalog.searches;
  expect(searches).toHaveLength(2);
  expect(searches[0].id).toBe("search1");
  expect(searches[0].name).toBe("my search");
  expect(searches[0].catalog).toBe(catalog);

  expect(SavedSearch.ref("search1").deref(LoggedIn)).toBe(searches[0]);

  expect(searches[0].ref().deref(LoggedIn)).toBe(searches[0]);

  let mutated = searches[0].ref().deref(Mutated);
  expect(mutated).not.toBe(searches[0]);
});

test("Dereferer.", (): void => {
  let dereferer = dereferencer(LoggedIn);

  let ref = Album.ref("testalbum1");
  let album = ref.deref(LoggedIn);
  expect(dereferer(ref)).toBe(album);
  expect(dereferer(undefined)).toBeUndefined();
});

test("Pending.", async (): Promise<void> => {
  let album = Album.ref("testalbum1").deref(LoggedIn);

  let pending = new PendingAPIItem(Promise.resolve(album.ref()));
  expect(pending.ref).toBeUndefined();

  let ref = await pending.promise;
  expect(ref.deref(LoggedIn)).toBe(album);
  expect(pending.ref).not.toBeUndefined();
  expect(pending.ref?.deref(LoggedIn)).toBe(album);
});

test("Bad tag state", (): void => {
  let state = mockServerState([{
    id: "catalog",
    name: "Catalog",
    tags: [{
      id: "tag",
      name: "Tag",
    }],
  }]);

  let tag = Tag.ref("tag").deref(state);
  expect(tag.children).toHaveLength(0);

  state.user?.catalogs.delete("catalog");
  expect((): void => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let children = tag.children;
  }).toThrowAppError(ErrorCode.UnknownCatalog);

  state.user = null;
  expect((): void => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let children = tag.children;
  }).toThrowAppError(ErrorCode.NotLoggedIn);
});

test("Bad album state", (): void => {
  let state = mockServerState([{
    id: "catalog",
    name: "Catalog",
    albums: [{
      id: "album",
      name: "Album",
    }],
  }]);

  let album = Album.ref("album").deref(state);
  expect(album.children).toHaveLength(0);

  state.user?.catalogs.delete("catalog");
  expect((): void => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let children = album.children;
  }).toThrowAppError(ErrorCode.UnknownCatalog);

  state.user = null;
  expect((): void => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let children = album.children;
  }).toThrowAppError(ErrorCode.NotLoggedIn);
});
