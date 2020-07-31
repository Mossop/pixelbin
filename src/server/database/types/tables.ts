import { ObjectModel } from "../../../model";
import { Nullable } from "../../../utils";

export type User = ObjectModel.User & { password: string };

export type Storage = ObjectModel.Storage;

export type Catalog = ObjectModel.Catalog;

export type Person = ObjectModel.Person;

export type Tag = ObjectModel.Tag;

export type Album = ObjectModel.Album;

// Not actually a table.
export type Metadata = Nullable<ObjectModel.Metadata>;

export type Media = ObjectModel.Media & Metadata;

export type UploadedMedia = ObjectModel.UploadedMedia & Metadata & {
  processVersion: number;
};

export type AlternateFile = ObjectModel.AlternateFile;
