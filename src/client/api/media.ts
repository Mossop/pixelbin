import type { Draft } from "immer";

import type { Api } from "../../model";
import { Method } from "../../model";
import type { MediaCreateRequest } from "../../model/api";
import type { Overwrite } from "../../utils";
import { request } from "./api";
import type { Album, Person, Tag, Reference, Catalog } from "./highlevel";
import type { MediaState, ProcessedMediaState } from "./types";
import { mediaIntoState } from "./types";

export type MediaTarget = Catalog | Album;

export async function getMedia(ids: string[]): Promise<(Draft<MediaState> | null)[]> {
  let media = await request(Method.MediaGet, {
    id: ids.join(","),
  });
  return media.map((media: Api.Media | null): Draft<MediaState> | null => {
    if (media) {
      return mediaIntoState(media);
    }
    return null;
  });
}

export type MediaCreateData = Overwrite<MediaCreateRequest, {
  catalog: Reference<Catalog>;
  albums?: Reference<Album>[];
  tags?: Reference<Tag>[];
  people?: Reference<Person>[];
}>;

export async function createMedia(media: MediaCreateData): Promise<MediaState> {
  let result = await request(Method.MediaCreate, {
    ...media,
    catalog: media.catalog.id,
    albums: media.albums ? media.albums.map((album: Reference<Album>): string => album.id) : [],
    tags: media.tags ? media.tags.map((tag: Reference<Tag>): string => tag.id) : [],
    people: media.people ? media.people.map((person: Reference<Person>): string => person.id) : [],
  });
  return mediaIntoState(result);
}

export function getThumbnailUrl(media: ProcessedMediaState, size: number): string {
  return `${media.thumbnailUrl}/${size}`;
}
