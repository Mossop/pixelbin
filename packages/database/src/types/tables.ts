import * as ObjectModel from "pixelbin-object-model";
import { Obj } from "pixelbin-utils";

import { DbRecord } from "./meta";

export type User = DbRecord<ObjectModel.User> & { password: string };

export type Catalog = DbRecord<ObjectModel.Catalog>;

export type Person = DbRecord<ObjectModel.Person>;

export type Tag = DbRecord<ObjectModel.Tag>;

export type Album = DbRecord<ObjectModel.Album>;

// Not actually a table.
export type Metadata = DbRecord<ObjectModel.Metadata>;

export type Media = DbRecord<ObjectModel.Media> & Metadata;

export type MediaInfo = DbRecord<ObjectModel.MediaInfo> & Metadata;

export type MediaWithInfo = Media & (Obj | Omit<MediaInfo, "media">);
