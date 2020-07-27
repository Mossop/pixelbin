import { Orientation } from "media-metadata";
import moment from "moment-timezone";

import { randomId } from ".";
import { Obj } from "../../../utils";
import { Tag, Reference, Album, Person } from "../api/highlevel";
import {
  MetadataData,
  MediaData,
  MediaInfoData,
  CatalogData,
  AlbumData,
  TagData,
  PersonData,
  ServerData,
} from "../api/types";

type Body = Blob | Obj | unknown[];

type Fetch = (
  input: RequestInfo,
  init?: RequestInit,
  body?: string | Record<string, string | Blob> | null,
) => Promise<Response>;

export class MockResponse<B extends Body> {
  public constructor(private statusCode: number, private body: B) {}

  public get ok(): boolean {
    return this.status < 400;
  }

  public get status(): number {
    return this.statusCode;
  }

  public get statusText(): string {
    return `Status ${this.status}`;
  }

  public blob(): Promise<B> {
    expect(this.body).toBeInstanceOf(Blob);
    return Promise.resolve(this.body);
  }

  public json(): Promise<B> {
    expect(this.body).not.toBeInstanceOf(Blob);
    return Promise.resolve(this.body);
  }
}

type ResponseBuilder<B extends Body> =
  (input: RequestInfo, init?: RequestInit | undefined) => MockResponse<B>;

export function mockResponse<B extends Body>(
  mockedFetch: jest.MockedFunction<Fetch>,
  fn: ResponseBuilder<B> | MockResponse<B>,
): void {
  mockedFetch.mockImplementationOnce((
    input: RequestInfo,
    init?: RequestInit | undefined,
  ): Promise<Response> => {
    let response = (fn instanceof MockResponse ? fn : fn(input, init)) as unknown as Response;
    return Promise.resolve(response);
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

export interface MetadataDataResponse {
  filename: string | null;
  title: string | null;
  taken: string | null;
  offset: number | null;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  orientation: Orientation | null;
  make: string | null;
  model: string | null;
  lens: string | null;
  photographer: string | null;
  aperture: number | null;
  exposure: number | null;
  iso: number | null;
  focalLength: number | null;
  bitrate: number | null;
}

export interface MediaInfoDataResponse {
  processVersion: number;
  uploaded: string;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  fileSize: number;
}

export interface MediaDataResponse {
  id: string;
  created: string;
  info: MediaInfoDataResponse | null;
  tags: string[];
  albums: string[];
  people: string[];
  metadata: MetadataDataResponse;
}

export interface TagDataResponse {
  id: string;
  catalog: string;
  parent: string | null;
  name: string;
}

export interface PersonDataResponse {
  id: string;
  catalog: string;
  name: string;
}

export interface AlbumDataResponse {
  id: string;
  catalog: string;
  stub: string | null;
  name: string;
  parent: string | null;
}

export interface CatalogDataResponse {
  id: string;
  name: string;
  people: PersonDataResponse[];
  tags: TagDataResponse[];
  albums: AlbumDataResponse[];
}

export interface UserDataResponse {
  email: string;
  fullname: string;
  hadCatalog: boolean;
  verified: boolean;
  catalogs: CatalogDataResponse[];
}

export interface ServerDataResponse {
  user: UserDataResponse | null;
}

export function mockMetadata(data: Partial<MetadataData>): MetadataData {
  return {
    filename: data.filename ?? null,
    title: data.title ?? null,
    taken: data.taken ?? null,
    offset: data.offset ?? null,
    longitude: data.longitude ?? null,
    latitude: data.latitude ?? null,
    altitude: data.altitude ?? null,
    location: data.location ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    country: data.country ?? null,
    orientation: data.orientation ?? null,
    make: data.make ?? null,
    model: data.model ?? null,
    lens: data.lens ?? null,
    photographer: data.photographer ?? null,
    aperture: data.aperture ?? null,
    exposure: data.exposure ?? null,
    iso: data.iso ?? null,
    focalLength: data.focalLength ?? null,
    bitrate: data.bitrate ?? null,
  };
}

export function mediaMetadataIntoResponse(metadata: MetadataData): MetadataDataResponse {
  return {
    ...metadata,
    taken: metadata.taken?.toISOString() ?? null,
  };
}

export function mockMediaInfo(data: Partial<MediaInfoData>): MediaInfoData {
  return {
    processVersion: data.processVersion ?? 1,
    uploaded: data.uploaded ?? moment().utc(),
    mimetype: data.mimetype ?? "image/jpeg",
    width: data.width ?? 1024,
    height: data.height ?? 768,
    duration: data.duration ?? null,
    fileSize: data.fileSize ?? 1000,
  };
}

export function uploadedMediaIntoResponse(info: MediaInfoData): MediaInfoDataResponse {
  return {
    ...info,
    uploaded: info.uploaded.toISOString(),
  };
}

export function mockMedia(data: Partial<MediaData>): MediaData {
  return {
    id: data.id ?? randomId(),
    created: data.created ?? moment().utc(),
    info: data.info ?? null,
    tags: data.tags ?? [],
    albums: data.albums ?? [],
    people: data.people ?? [],
    metadata: data.metadata ?? mockMetadata({}),
  };
}

export function mediaIntoResponse(media: MediaData): MediaDataResponse {
  return {
    ...media,
    created: media.created.toISOString(),
    info: media.info ? uploadedMediaIntoResponse(media.info) : null,
    metadata: mediaMetadataIntoResponse(media.metadata),
    albums: media.albums.map((ref: Reference<Album>): string => ref.id),
    tags: media.tags.map((ref: Reference<Tag>): string => ref.id),
    people: media.people.map((ref: Reference<Person>): string => ref.id),
  };
}

export function albumIntoResponse(album: AlbumData): AlbumDataResponse {
  return {
    ...album,
    parent: album.parent?.id ?? null,
    catalog: album.catalog.id,
  };
}

export function tagIntoResponse(tag: TagData): TagDataResponse {
  return {
    ...tag,
    parent: tag.parent?.id ?? null,
    catalog: tag.catalog.id,
  };
}

export function personIntoResponse(person: PersonData): PersonDataResponse {
  return {
    ...person,
    catalog: person.catalog.id,
  };
}

export function catalogIntoResponse(catalog: CatalogData): CatalogDataResponse {
  return {
    ...catalog,
    albums: Array.from(catalog.albums.values(), albumIntoResponse),
    tags: Array.from(catalog.tags.values(), tagIntoResponse),
    people: Array.from(catalog.people.values(), personIntoResponse),
  };
}

export function serverDataIntoResponse(serverData: ServerData): ServerDataResponse {
  let user: UserDataResponse | null = null;
  if (serverData.user) {
    user = {
      ...serverData.user,
      catalogs: Array.from(serverData.user.catalogs.values(), catalogIntoResponse),
    };
  }

  return {
    user,
  };
}
