import { expect } from "../../test-helpers";
import { idSorted } from "../../utils";
import {
  listCatalogs,
  listTags,
  listAlbums,
  listPeople,
  createCatalog,
  createAlbum,
  editAlbum,
  createTag,
  editTag,
  createPerson,
  editPerson,
  listStorage,
  createStorage,
  albumAddMedia,
  albumRemoveMedia,
} from "./catalog";
import { connection } from "./connection";
import { createMedia, fillMetadata } from "./media";
import { from } from "./queries";
import { insertTestData, testData, buildTestDB } from "./test-helpers";
import { Table } from "./types";
import { MediaAlbum } from "./types/joins";

buildTestDB();

beforeEach((): Promise<void> => {
  return insertTestData();
});

test("Storage tests", async (): Promise<void> => {
  let allStorage = idSorted(await listStorage("someone1@nowhere.com"));
  expect(allStorage).toHaveLength(2);
  expect(allStorage).toEqual(testData[Table.Storage]);

  allStorage = idSorted(await listStorage("someone2@nowhere.com"));
  expect(allStorage).toHaveLength(1);
  expect(allStorage).toEqual([testData[Table.Storage][0]]);

  let storage = await createStorage({
    name: "My new storage",
    accessKeyId: "foobar",
    secretAccessKey: "baz",
    publicUrl: null,
    region: "fooend",
    endpoint: null,
    path: null,
    bucket: "buckit",
  });

  expect(storage).toEqual({
    id: expect.stringMatching(/S:[a-zA-Z0-9]+/),
    name: "My new storage",
    accessKeyId: "foobar",
    secretAccessKey: "baz",
    publicUrl: null,
    region: "fooend",
    endpoint: null,
    path: null,
    bucket: "buckit",
  });
});

test("Catalog tests", async (): Promise<void> => {
  let catalogs = idSorted(await listCatalogs("someone1@nowhere.com"));
  expect(catalogs).toHaveLength(3);
  expect(catalogs).toEqual(testData[Table.Catalog]);

  catalogs = idSorted(await listCatalogs("someone2@nowhere.com"));
  expect(catalogs).toHaveLength(1);
  expect(catalogs).toEqual([testData[Table.Catalog][0]]);

  catalogs = idSorted(await listCatalogs("someone3@nowhere.com"));
  expect(catalogs).toHaveLength(2);
  expect(catalogs).toEqual([
    testData[Table.Catalog][1],
    testData[Table.Catalog][2],
  ]);

  // Can duplicate name.
  let catalog = await createCatalog("someone1@nowhere.com", {
    storage: "s1",
    name: "Catalog 1",
  });
  expect(catalog).toEqual({
    id: expect.stringMatching(/[a-zA-Z0-9]+/),
    storage: "s1",
    name: "Catalog 1",
  });

  catalog = await createCatalog("someone2@nowhere.com", {
    storage: "s1",
    name: "New catalog",
  });
  expect(catalog).toEqual({
    id: expect.stringMatching(/[a-zA-Z0-9]+/),
    storage: "s1",
    name: "New catalog",
  });

  catalogs = idSorted(await listCatalogs("someone2@nowhere.com"));
  expect(catalogs).toHaveLength(2);
  expect(catalogs).toEqual([
    catalog,
    testData[Table.Catalog][0],
  ]);

  await expect(createCatalog("someone5@nowhere.com", {
    storage: "s1",
    name: "New catalog",
  })).rejects.toThrow("foreign key");

  await expect(createCatalog("someone1@nowhere.com", {
    storage: "s5",
    name: "New catalog",
  })).rejects.toThrow("foreign key");
});

test("Tag table tests", async (): Promise<void> => {
  let tags = idSorted(await listTags("someone1@nowhere.com"));
  expect(tags).toHaveLength(8);
  expect(tags).toEqual(testData[Table.Tag]);

  tags = idSorted(await listTags("someone2@nowhere.com"));
  expect(tags).toHaveLength(5);
  expect(tags).toEqual([
    testData[Table.Tag][0],
    testData[Table.Tag][1],
    testData[Table.Tag][5],
    testData[Table.Tag][6],
    testData[Table.Tag][7],
  ]);

  let tag = await createTag("someone1@nowhere.com", "c1", {
    // @ts-ignore: Supplying an ID should not affect anything.
    id: "Bad",
    // @ts-ignore: Supplying a catalog should not affect anything.
    catalog: "c2",
    parent: null,
    name: "New Tag",
  });

  expect(tag.id).not.toBe("Bad");
  expect(tag).toEqual({
    id: expect.stringMatching(/^T:[A-Za-z0-9]+/),
    catalog: "c1",
    parent: null,
    name: "New Tag",
  });

  // Creating a tag that already exists should return the tag.
  tag = await createTag("someone1@nowhere.com", "c1", {
    parent: null,
    name: "Tag1",
  });

  expect(tag).toEqual({
    id: "t1",
    catalog: "c1",
    parent: null,
    name: "Tag1",
  });

  // Shouldn't allow adding to a catalog that doesn't exist.
  await expect(createTag("someone1@nowhere.com", "c8", {
    parent: null,
    name: "New Tag",
  })).rejects.toThrow("Invalid user or catalog passed to createTag");

  // Or with a user that doesn't exist.
  await expect(createTag("foobar@nowhere.com", "c1", {
    parent: null,
    name: "New Tag",
  })).rejects.toThrow("Invalid user or catalog passed to createTag");

  // Or with a user that doesn't have access to the catalog
  await expect(createTag("someone3@nowhere.com", "c1", {
    parent: null,
    name: "New Tag",
  })).rejects.toThrow("Invalid user or catalog passed to createTag");

  let updated = await editTag("someone1@nowhere.com", tag.id, {
    // @ts-ignore: Attempts to change id should be ignored.
    id: "newId",
    // @ts-ignore: Ditto for catalog.
    catalog: "c2",
    name: "New name",
    parent: "t1",
  });

  expect(updated).toEqual({
    ...tag,
    parent: "t1",
    name: "New name",
  });

  // Attempting to alter a tag in a catalog the user cannot access should fail.
  await expect(editTag("someone3@nowhere.com", "t1", {
    name: "Bad name",
  })).rejects.toThrow("Invalid user or album passed to editTag");

  // Attempting to alter a tag that doesn't exist should fail.
  await expect(editTag("someone3@nowhere.com", "t16", {
    name: "Bad name",
  })).rejects.toThrow("Invalid user or album passed to editTag");

  // Changing to a bad parent should fail.
  await expect(editTag("someone2@nowhere.com", tag.id, {
    parent: "t3",
  })).rejects.toThrow("foreign key constraint");
});

test("Album table tests", async (): Promise<void> => {
  let albums = idSorted(await listAlbums("someone1@nowhere.com"));
  expect(albums).toHaveLength(8);
  expect(albums).toEqual(testData[Table.Album]);

  albums = idSorted(await listAlbums("someone2@nowhere.com"));
  expect(albums).toHaveLength(5);
  expect(albums).toEqual([
    testData[Table.Album][0],
    testData[Table.Album][1],
    testData[Table.Album][2],
    testData[Table.Album][3],
    testData[Table.Album][4],
  ]);

  albums = idSorted(await listAlbums("someone3@nowhere.com"));
  expect(albums).toHaveLength(3);
  expect(albums).toEqual([
    testData[Table.Album][5],
    testData[Table.Album][6],
    testData[Table.Album][7],
  ]);

  let album = await createAlbum("someone1@nowhere.com", "c1", {
    // @ts-ignore: Supplying an ID should not affect anything.
    id: "Bad",
    // @ts-ignore: Supplying a catalog should not affect anything.
    catalog: "c2",
    parent: null,
    stub: "foo",
    name: "New Album",
  });

  expect(album.id).not.toBe("Bad");
  expect(album).toEqual({
    id: expect.stringMatching(/^A:[A-Za-z0-9]+/),
    catalog: "c1",
    parent: null,
    stub: "foo",
    name: "New Album",
  });

  // Shouldn't allow adding to a catalog that doesn't exist.
  await expect(createAlbum("someone1@nowhere.com", "c8", {
    parent: null,
    stub: "foo",
    name: "New Album",
  })).rejects.toThrow("Invalid user or catalog passed to createAlbum");

  // Or with a user that doesn't exist.
  await expect(createAlbum("foobar@nowhere.com", "c1", {
    parent: null,
    stub: "foo",
    name: "New Album",
  })).rejects.toThrow("Invalid user or catalog passed to createAlbum");

  // Or with a user that doesn't have access to the catalog
  await expect(createAlbum("someone3@nowhere.com", "c1", {
    parent: null,
    stub: "foo",
    name: "New Album",
  })).rejects.toThrow("Invalid user or catalog passed to createAlbum");

  let updated = await editAlbum("someone1@nowhere.com", album.id, {
    // @ts-ignore: Attempts to change id should be ignored.
    id: "newId",
    // @ts-ignore: Ditto for catalog.
    catalog: "c2",
    name: "New name",
    parent: "a1",
  });

  expect(updated).toEqual({
    ...album,
    parent: "a1",
    name: "New name",
  });

  // Attempting to alter an album in a catalog the user cannot access should fail.
  await expect(editAlbum("someone3@nowhere.com", "a1", {
    name: "Bad name",
  })).rejects.toThrow("Invalid user or album passed to editAlbum");

  // Attempting to alter an album that doesn't exist should fail.
  await expect(editAlbum("someone3@nowhere.com", "a16", {
    name: "Bad name",
  })).rejects.toThrow("Invalid user or album passed to editAlbum");

  // Changing to a bad parent should fail.
  await expect(editAlbum("someone2@nowhere.com", album.id, {
    parent: "a6",
  })).rejects.toThrow("foreign key constraint");
});

test("Album media tests", async (): Promise<void> => {
  let knex = await connection;

  let mediaInAlbum = async (album: string): Promise<string[]> => {
    let media = await from(knex, Table.MediaAlbum).where("album", album).select("*");
    return media.map((item: MediaAlbum): string => item.media);
  };

  let media1 = await createMedia("someone1@nowhere.com", "c1", fillMetadata({}));
  let media2 = await createMedia("someone1@nowhere.com", "c1", fillMetadata({}));
  let media3 = await createMedia("someone1@nowhere.com", "c1", fillMetadata({}));
  let media4 = await createMedia("someone1@nowhere.com", "c2", fillMetadata({}));
  let media5 = await createMedia("someone1@nowhere.com", "c2", fillMetadata({}));

  expect(await mediaInAlbum("a1")).toEqual([]);

  let added = await albumAddMedia("someone1@nowhere.com", "a1", [
    media1.id,
    media2.id,
    media3.id,
    media4.id,
  ]);

  expect(added).toInclude([
    media1.id,
    media2.id,
    media3.id,
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media1.id,
    media2.id,
    media3.id,
  ]);

  added = await albumAddMedia("someone1@nowhere.com", "a1", [
    media1.id,
    media2.id,
    media3.id,
  ]);

  expect(added).toEqual([]);

  expect(await mediaInAlbum("a1")).toInclude([
    media1.id,
    media2.id,
    media3.id,
  ]);

  await albumRemoveMedia("someone1@nowhere.com", "a1", [
    media1.id,
    "unknown",
    media4.id,
  ]);

  expect(await mediaInAlbum("a1")).toInclude([
    media2.id,
    media3.id,
  ]);

  await albumRemoveMedia("someone1@nowhere.com", "a1", [
    media2.id,
    media3.id,
  ]);

  expect(await mediaInAlbum("a1")).toEqual([]);

  added = await albumAddMedia("someone2@nowhere.com", "a6", [
    media4.id,
    media5.id,
  ]);

  expect(added).toEqual([]);

  expect(await mediaInAlbum("a6")).toEqual([]);

  added = await albumAddMedia("someone1@nowhere.com", "a6", [
    media4.id,
    media5.id,
  ]);

  expect(added).toInclude([
    media4.id,
    media5.id,
  ]);

  expect(await mediaInAlbum("a6")).toInclude([
    media4.id,
    media5.id,
  ]);

  await albumRemoveMedia("someone2@nowhere.com", "a6", [
    media4.id,
    media5.id,
  ]);

  expect(await mediaInAlbum("a6")).toInclude([
    media4.id,
    media5.id,
  ]);
});

test("Person table tests", async (): Promise<void> => {
  let people = idSorted(await listPeople("someone1@nowhere.com"));
  expect(people).toHaveLength(6);
  expect(people).toEqual(testData[Table.Person]);

  people = idSorted(await listPeople("someone2@nowhere.com"));
  expect(people).toHaveLength(2);
  expect(people).toEqual([
    testData[Table.Person][0],
    testData[Table.Person][1],
  ]);

  people = idSorted(await listPeople("someone3@nowhere.com"));
  expect(people).toHaveLength(4);
  expect(people).toEqual([
    testData[Table.Person][2],
    testData[Table.Person][3],
    testData[Table.Person][4],
    testData[Table.Person][5],
  ]);

  let person = await createPerson("someone1@nowhere.com", "c1", {
    // @ts-ignore: Supplying an ID should not affect anything.
    id: "Bad",
    // @ts-ignore: Supplying a catalog should not affect anything.
    catalog: "c2",
    name: "New Person",
  });

  expect(person.id).not.toBe("Bad");
  expect(person).toEqual({
    id: expect.stringMatching(/^P:[A-Za-z0-9]+/),
    catalog: "c1",
    name: "New Person",
  });

  // Creating a person with the same name should just return the same person.
  person = await createPerson("someone1@nowhere.com", "c1", {
    name: "person 1",
  });
  expect(person).toEqual({
    id: "p1",
    catalog: "c1",
    name: "person 1",
  });

  // Shouldn't allow adding to a catalog that doesn't exist.
  await expect(createPerson("someone1@nowhere.com", "c8", {
    name: "New Person",
  })).rejects.toThrow("Invalid user or catalog passed to createPerson");

  // Or with a user that doesn't exist.
  await expect(createPerson("foobar@nowhere.com", "c1", {
    name: "New Person",
  })).rejects.toThrow("Invalid user or catalog passed to createPerson");

  // Or with a user that doesn't have access to the catalog
  await expect(createPerson("someone3@nowhere.com", "c1", {
    name: "New Tag",
  })).rejects.toThrow("Invalid user or catalog passed to createPerson");

  let updated = await editPerson("someone1@nowhere.com", person.id, {
    // @ts-ignore: Attempts to change id should be ignored.
    id: "newId",
    // @ts-ignore: Ditto for catalog.
    catalog: "c2",
    name: "New name",
  });

  expect(updated).toEqual({
    ...person,
    name: "New name",
  });

  // Attempting to alter a person in a catalog the user cannot access should fail.
  await expect(editPerson("someone3@nowhere.com", "p2", {
    name: "Bad name",
  })).rejects.toThrow("Invalid user or album passed to editPerson");

  // Attempting to alter a person that doesn't exist should fail.
  await expect(editPerson("someone3@nowhere.com", "p16", {
    name: "Bad name",
  })).rejects.toThrow("Invalid user or album passed to editPerson");
});
