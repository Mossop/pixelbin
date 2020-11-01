import type { ObjectModel } from "../../../model";
import type { Overwrite } from "../../../utils";

export type User = ObjectModel.User & {
  password: string;
};

export type Storage = ObjectModel.Storage & {
  owner: User["email"];
};

export type Catalog = ObjectModel.Catalog & {
  storage: Storage["id"];
};

export type Person = ObjectModel.Person & {
  catalog: Catalog["id"];
};

export type Tag = ObjectModel.Tag & {
  catalog: Catalog["id"];
};

export type Album = ObjectModel.Album & {
  catalog: Catalog["id"];
};

export type SavedSearch = ObjectModel.SavedSearch & {
  catalog: Catalog["id"];
};

// Not actually a table.
export type Metadata = ObjectModel.Metadata;

export type MediaInfo = ObjectModel.MediaInfo & Metadata & {
  catalog: Catalog["id"];
  deleted: boolean;
};

export type MediaFile = ObjectModel.MediaFile & Metadata & {
  media: MediaInfo["id"];
  fileName: string;
};

export type AlternateFile = ObjectModel.AlternateFile & {
  mediaFile: MediaFile["id"];
  fileName: string;
};

// A generated view.
export type MediaView = Omit<MediaInfo, "deleted"> & {
  file: null | Overwrite<ObjectModel.MediaFile, {
    uploaded: string;
    fileName: string;
  }>;
  albums: (ObjectModel.MediaAlbum & { album: Album["id"] })[];
  tags: (ObjectModel.MediaTag & { tag: Tag["id"] })[];
  people: (ObjectModel.MediaPerson & { person: Person["id"] })[];
};
