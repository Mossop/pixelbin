import { ObjectModel } from "../../../model";
import { Nullable } from "../../../utils";
import { AllOrNulls } from "./meta";

export type User = ObjectModel.User & { password: string };

export type Storage = ObjectModel.Storage;

export type Catalog = ObjectModel.Catalog;

export type Person = ObjectModel.Person;

export type Tag = ObjectModel.Tag;

export type Album = ObjectModel.Album;

// Not actually a table.
export type Metadata = Nullable<ObjectModel.Metadata>;

export type Media = ObjectModel.Media & Metadata;

export type Original = ObjectModel.Original & Metadata & {
  processVersion: number;
};

export type CurrentOriginal = Omit<Original, "id">;

export type AlternateFile = ObjectModel.AlternateFile;

export type StoredMedia = Media & AllOrNulls<
  Omit<ObjectModel.Original, "id" | "media" | "fileName">
> & ObjectModel.MediaLists;
