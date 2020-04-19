import { Catalog, Reference, Tag, Album } from "../../js/api/highlevel";
import { CatalogData, ServerData, PersonData, TagData, AlbumData } from "../../js/api/types";
import { intoMap } from "../../js/utils/maps";

type MockPerson = Omit<PersonData, "id" | "catalog"> & {
  id?: string;
};
type MockAlbum = Omit<AlbumData, "id" | "catalog" | "parent"> & {
  id?: string;
  children?: MockAlbum[];
};
type MockTag = Omit<TagData, "id" | "catalog" | "parent"> & {
  id?: string;
  children?: MockTag[];
};
type MockCatalog = Omit<CatalogData, "id" | "people" | "tags" | "albums"> & {
  id?: string;
  albums?: MockAlbum[];
  tags?: MockTag[];
  people?: MockPerson[];
};

function randomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function *iterAlbums(
  catalog: Reference<Catalog>,
  parent: Reference<Album> | null,
  mocks: MockAlbum[] | undefined,
): Iterable<AlbumData> {
  if (!mocks) {
    return;
  }

  for (let mock of mocks) {
    let id = mock.id ?? randomId();
    let ref = Album.ref(id);

    yield {
      ...mock,
      id,
      catalog,
      parent,
    };

    yield* iterAlbums(catalog, ref, mock.children);
  }
}

function *iterTags(
  catalog: Reference<Catalog>,
  parent: Reference<Tag> | null,
  mocks: MockTag[] | undefined,
): Iterable<TagData> {
  if (!mocks) {
    return;
  }

  for (let mock of mocks) {
    let id = mock.id ?? randomId();
    let ref = Tag.ref(id);

    yield {
      ...mock,
      id,
      catalog,
      parent,
    };

    yield* iterTags(catalog, ref, mock.children);
  }
}

function *iterPeople(
  catalog: Reference<Catalog>,
  mocks: MockPerson[] | undefined,
): Iterable<PersonData> {
  if (!mocks) {
    return;
  }

  for (let mock of mocks) {
    let id = mock.id ?? randomId();

    yield {
      ...mock,
      id,
      catalog,
    };
  }
}

export function mockCatalog(mock: MockCatalog): CatalogData {
  let id = mock.id ?? randomId();
  let ref = Catalog.ref(id);

  return {
    ...mock,
    id,
    albums: intoMap(iterAlbums(ref, null, mock.albums)),
    people: intoMap(iterPeople(ref, mock.people)),
    tags: intoMap(iterTags(ref, null, mock.tags)),
  };
}

export function mockServerData(catalogs: MockCatalog[]): ServerData {
  return {
    user: {
      email: "dtownsend@oxymoronical.com",
      fullname: "Dave Townsend",
      hadCatalog: true,
      verified: true,
      catalogs: intoMap(catalogs.map(mockCatalog)),
    },
  };
}