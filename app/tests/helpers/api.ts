import moment from "moment";

import { randomId } from ".";
import { UnprocessedMediaData } from "../../js/api/media";
import { MetadataData } from "../../js/api/types";

type Body = Blob | object | unknown[];

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
  mockedFetch: jest.MockedFunction<typeof fetch>,
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

export function callInfo(mockedFetch: jest.MockedFunction<typeof fetch>): CallInfo {
  expect(mockedFetch).toHaveBeenCalledTimes(1);
  let args = mockedFetch.mock.calls[0];
  expect(args.length).toBeGreaterThanOrEqual(1);
  expect(args.length).toBeLessThanOrEqual(2);
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

    if ("body" in args[1]) {
      if (args[1].body instanceof Blob) {
        info.body = args[1].body;
      } else if (typeof args[1].body == "string") {
        info.body = JSON.parse(args[1].body);
      }
    }

    if ("method" in args[1]) {
      info.method = args[1].method as string;
    }
  }

  return info;
}

export function metadata(data: Partial<MetadataData>): MetadataData {
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

export function unprocessedMedia(data: Partial<UnprocessedMediaData>): UnprocessedMediaData {
  return {
    id: data.id ?? randomId(),
    created: data.created ?? moment(),
    processVersion: null,
    uploaded: null,
    mimetype: null,
    width: null,
    height: null,
    duration: null,
    fileSize: null,
    tags: data.tags ?? [],
    albums: data.albums ?? [],
    people: data.people ?? [],
    metadata: data.metadata ?? metadata({}),
  };
}