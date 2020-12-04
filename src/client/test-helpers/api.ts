/* eslint-disable @typescript-eslint/consistent-type-imports */
import { act } from "@testing-library/react";

import type { Api, Query } from "../../model";
import type { ApiSerialization, ErrorData } from "../../model/api";
import { deferCall, DeferredCall, mockedFunction } from "../../test-helpers";
import type { Obj } from "../../utils";
import { isDateTime, isoDateTime } from "../../utils";
import { request } from "../api/api";
import type {
  CatalogState,
  AlbumState,
  TagState,
  PersonState,
  ServerState,
  MediaState,
  SavedSearchState,
} from "../api/types";
import fetch from "../environment/fetch";

type Body = Blob | Obj | unknown[];

type Fetch = (
  input: RequestInfo,
  init?: RequestInit,
  body?: string | Record<string, string | Blob> | null,
) => Promise<Response>;

export class MockResponse {
  public constructor(
    private statusCode: number,
    private body: unknown,
  ) {}

  public get ok(): boolean {
    return this.status < 400;
  }

  public get status(): number {
    return this.statusCode;
  }

  public get statusText(): string {
    return `Status ${this.status}`;
  }

  public blob(): Promise<unknown> {
    expect(this.body).toBeInstanceOf(Blob);
    return Promise.resolve(this.body);
  }

  public json(): Promise<unknown> {
    expect(this.body).not.toBeInstanceOf(Blob);
    return Promise.resolve(this.body);
  }
}

type MockResponseType<M extends Api.Method> = Api.SignatureResponse<M> extends void
  ? undefined
  : ApiSerialization<Api.SignatureResponse<M>>;
export function mockResponse<M extends Api.Method>(
  method: M,
  statusCode: number,
  response: MockResponseType<M> | ErrorData,
): void {
  let mockedFetch = mockedFunction(fetch);

  mockedFetch.mockImplementationOnce((): Promise<Response> => {
    let mockResponse = new MockResponse(statusCode, response);
    return Promise.resolve(mockResponse as unknown as Response);
  });
}

interface CallInfo {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: Body;
}

export function callInfo(mockedFetch: jest.MockedFunction<Fetch>): CallInfo {
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  let args = mockedFetch.mock.calls[0];
  expect(args.length).toBeGreaterThanOrEqual(1);
  expect(args.length).toBeLessThanOrEqual(3);
  expect(typeof args[0]).toBe("string");

  let info: CallInfo = {
    method: "GET",
    path: args[0] as string,
  };

  if (args[1]) {
    expect(typeof args[1]).toBe("object");

    if ("headers" in args[1]) {
      info.headers = args[1].headers as Record<string, string>;
    }

    if ("method" in args[1]) {
      info.method = args[1].method as string;
    }
  }

  if (args[2]) {
    if (typeof args[2] == "string") {
      info.body = JSON.parse(args[2]);
    } else {
      info.body = args[2];
    }
  }

  return info;
}

export function mediaIntoResponse(
  media: MediaState,
): ApiSerialization<Api.Media> {
  let file: ApiSerialization<Api.MediaFile> | null = null;
  if (media.file) {
    let {
      url,
      thumbnails,
      encodings,
      videoEncodings,
      ...fields
    } = media.file;

    file = {
      ...fields,
      uploaded: isoDateTime(media.file.uploaded),
    };
  }

  return {
    ...media,
    created: isoDateTime(media.created),
    updated: isoDateTime(media.updated),
    taken: media.taken ? isoDateTime(media.taken) : null,

    file,

    catalog: media.catalog.id,
  };
}

export function personIntoResponse(person: PersonState): Api.Person {
  let result: Api.Person = {
    ...person,
    catalog: person.catalog.id,
  };

  return result;
}

export function albumIntoResponse(album: AlbumState): Api.Album {
  let result: Api.Album = {
    ...album,
    parent: album.parent?.id ?? null,
    catalog: album.catalog.id,
  };

  return result;
}

export function tagIntoResponse(tag: TagState): Api.Tag {
  let result: Api.Tag = {
    ...tag,
    parent: tag.parent?.id ?? null,
    catalog: tag.catalog.id,
  };

  return result;
}

function queryIntoResponse(query: Query): ApiSerialization<Query> {
  if (query.type == "compound") {
    return {
      ...query,
      queries: query.queries.map(queryIntoResponse),
    };
  }

  return {
    ...query,
    value: isDateTime(query.value) ? isoDateTime(query.value) : query.value,
  };
}

export function searchIntoResponse(search: SavedSearchState): ApiSerialization<Api.SavedSearch> {
  return {
    ...search,
    catalog: search.catalog.id,
    query: queryIntoResponse(search.query),
  };
}

export function catalogIntoResponse(catalog: CatalogState): Api.Catalog {
  let {
    tags,
    albums,
    people,
    searches,
    ...rest
  } = catalog;

  return rest;
}

export function serverDataIntoResponse(serverState: ServerState): ApiSerialization<Api.State> {
  let user: ApiSerialization<Api.User> | null = null;
  if (serverState.user) {
    let albums: Api.Album[] = [];
    let tags: Api.Tag[] = [];
    let people: Api.Person[] = [];
    let catalogs: Api.Catalog[] = [];
    let searches: ApiSerialization<Api.SavedSearch>[] = [];

    for (let catalog of serverState.user.catalogs.values()) {
      catalogs.push(catalogIntoResponse(catalog));

      for (let album of catalog.albums.values()) {
        albums.push(albumIntoResponse(album));
      }

      for (let person of catalog.people.values()) {
        people.push(personIntoResponse(person));
      }

      for (let album of catalog.albums.values()) {
        albums.push(albumIntoResponse(album));
      }

      for (let search of catalog.searches.values()) {
        searches.push(searchIntoResponse(search));
      }
    }

    user = {
      ...serverState.user,

      storage: [...serverState.user.storage.values()],
      catalogs,
      people,
      tags,
      albums,
      searches,
    };
  }

  // @ts-ignore: Draft status problems.
  return {
    ...serverState,
    user,
    apiHost: null,
  };
}

type Req<M extends Api.Method> = Api.SignatureRequest<M>;
type Rsp<M extends Api.Method> = Api.SignatureResponse<M>;
export function deferRequest<M extends Api.Method>(): DeferredCall<[Api.Method, Req<M>], Rsp<M>> {
  let {
    call,
    reject,
    resolve,
    promise,
  } = deferCall(request as unknown as (method: Api.Method, data: Req<M>) => Promise<Rsp<M>>);
  return {
    call,
    resolve: async (...args: Parameters<typeof resolve>): Promise<void> => {
      await act(() => {
        return resolve(...args);
      });
    },
    reject: async (...args: Parameters<typeof reject>): Promise<void> => {
      await act(() => {
        return reject(...args);
      });
    },
    promise,
  };
}
