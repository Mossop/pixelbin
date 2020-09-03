import { ObjectModel } from "../../../model";

export interface UserCatalog {
  user: string;
  catalog: string;
}

export interface MediaAlbum {
  catalog: string;
  media: string;
  album: string;
}

export interface MediaTag {
  catalog: string;
  media: string;
  tag: string;
}

export interface MediaPerson {
  catalog: string;
  media: string;
  person: string;
  location: ObjectModel.Location | null;
}
