import * as ObjectModel from "pixelbin-object-model";

import { DbRecord } from "./meta";

export type User = DbRecord<ObjectModel.User> & { password: string };

export type Catalog = DbRecord<ObjectModel.Catalog>;

export type Person = DbRecord<ObjectModel.Person>;

export type Tag = DbRecord<ObjectModel.Tag>;

export type Album = DbRecord<ObjectModel.Album>;

export type Media = DbRecord<ObjectModel.Media> & DbRecord<ObjectModel.Metadata>;

export type MediaInfo = DbRecord<ObjectModel.MediaInfo> & DbRecord<ObjectModel.Metadata>;
