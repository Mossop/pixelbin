import type { ObjectModel } from "../../../model";

export interface SharedCatalog {
  user: string;
  catalog: string;
  writable: boolean;
}

export type UserCatalog = SharedCatalog;

export type MediaAlbum = ObjectModel.MediaAlbum & {
  catalog: string;
  media: string;
  album: string;
};

export type MediaTag = ObjectModel.MediaTag & {
  catalog: string;
  media: string;
  tag: string;
};

export type MediaPerson = ObjectModel.MediaPerson & {
  catalog: string;
  media: string;
  person: string;
};
