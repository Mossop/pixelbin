import { Api, ResponseFor } from "../../model";
import { ErrorData } from "../../model/api";
import { mockedFunction } from "../../test-helpers";
import { Obj } from "../../utils";
import { Tag, Reference, Album } from "../api/highlevel";
import {
  CatalogState,
  AlbumState,
  TagState,
  PersonState,
  ServerState,
  MediaState,
  isProcessed,
  MediaPersonState,
  ProcessedMediaState,
  UnprocessedMediaState,
} from "../api/types";
import fetch from "../environment/fetch";

const {
  isoDateTime,
} = jest.requireActual<typeof import("../../utils/datetime")>("../../utils/datetime");

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

export function mockResponse<M extends Api.Method>(
  method: M,
  statusCode: number,
  response: ResponseFor<Api.SignatureResponse<M>> | ErrorData,
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
  serverState: ServerState,
  media: ProcessedMediaState,
): ResponseFor<Api.ProcessedMedia>;
export function mediaIntoResponse(
  serverState: ServerState,
  media: UnprocessedMediaState,
): ResponseFor<Api.UnprocessedMedia>;
export function mediaIntoResponse(
  serverState: ServerState,
  media: MediaState,
): ResponseFor<Api.Media> {
  let response: ResponseFor<MediaState>;
  if (isProcessed(media)) {
    response = {
      ...media,
      created: isoDateTime(media.created),
      updated: isoDateTime(media.updated),
      uploaded: isoDateTime(media.uploaded),
      taken: media.taken ? isoDateTime(media.taken) : null,
    };
  } else {
    response = {
      ...media,
      created: isoDateTime(media.created),
      updated: isoDateTime(media.updated),
      taken: media.taken ? isoDateTime(media.taken) : null,
    };
  }

  return {
    ...response,
    albums: media.albums.map(
      (ref: Reference<Album>): Api.Album => albumIntoResponse(ref.deref(serverState).toState()),
    ),
    tags: media.tags.map(
      (ref: Reference<Tag>): Api.Tag => tagIntoResponse(ref.deref(serverState).toState()),
    ),
    people: media.people.map((state: MediaPersonState): Api.MediaPerson => {
      return personIntoResponse(state.person.deref(serverState).toState());
    }),
  };
}

export function personIntoResponse(person: PersonState): Api.MediaPerson {
  let result: Api.MediaPerson = {
    ...person,
    location: null,
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

export function catalogIntoResponse(catalog: CatalogState): Api.Catalog {
  let result: Api.Catalog = {
    ...catalog,
  };

  return result;
}

export function serverDataIntoResponse(serverState: ServerState): ResponseFor<Api.State> {
  let user: ResponseFor<Api.User> | null = null;
  if (serverState.user) {
    let albums: Api.Album[] = [];
    let tags: Api.Tag[] = [];
    let people: Api.Person[] = [];
    let catalogs: Api.Catalog[] = [];

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
    }

    user = {
      ...serverState.user,

      storage: [...serverState.user.storage.values()],
      catalogs,
      people,
      tags,
      albums,
    };
  }

  return {
    user,
  };
}
