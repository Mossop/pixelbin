import * as ObjectModel from "pixelbin-object-model";
import { DbRecord } from "./meta";
export declare type User = DbRecord<ObjectModel.User>;
export declare type Catalog = DbRecord<ObjectModel.Catalog>;
export declare type Person = DbRecord<ObjectModel.Person>;
export declare type Tag = DbRecord<ObjectModel.Tag>;
export declare type Album = DbRecord<ObjectModel.Album>;
export declare type Media = DbRecord<ObjectModel.Media> & DbRecord<ObjectModel.Metadata>;
export declare type MediaInfo = DbRecord<ObjectModel.MediaInfo> & DbRecord<ObjectModel.Metadata>;
