import * as ObjectModel from "../../../model/models";
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

export type MediaInfo = ObjectModel.MediaInfo & Metadata & {
  processVersion: number;
};

type AllNull<T> = {
  [K in keyof T]: null;
};

type AllOrNulls<T> = T | AllNull<T>;

export type MediaWithInfo = Media & AllOrNulls<Omit<MediaInfo, "media">>;
