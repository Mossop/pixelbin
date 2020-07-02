import * as ObjectModel from "../../../model/models";
import { Obj } from "../../../utils";
import { DbRecord } from "./meta";

export type User = DbRecord<ObjectModel.User> & { password: string };

export type Storage = DbRecord<ObjectModel.Storage>;

export type Catalog = DbRecord<ObjectModel.Catalog>;

export type Person = DbRecord<ObjectModel.Person>;

export type Tag = DbRecord<ObjectModel.Tag>;

export type Album = DbRecord<ObjectModel.Album>;

// Not actually a table.
export type Metadata = DbRecord<ObjectModel.Metadata>;

export type Media = DbRecord<ObjectModel.Media> & Metadata;

export type MediaInfo = DbRecord<ObjectModel.MediaInfo> & Metadata & {
  processVersion: number;
};

export type MediaWithInfo = Media & (Obj | Omit<MediaInfo, "media" | "processVersion">);
