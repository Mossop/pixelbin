import { DateTime } from "luxon";
import { Dispatch, SetStateAction } from "react";

export type Replace<A, B> = Omit<A, keyof B> & B;
export type DispatchSSA<T> = Dispatch<SetStateAction<T>>;

export interface HistoryState {
  fromGallery?: boolean;
  expandSearchBar?: boolean;
}

export interface User {
  email: string;
  fullname: string | null;
  administrator: boolean;
  created: string;
  lastLogin: string;
  verified: boolean;
}

export interface Storage {
  id: string;
  name: string;
  bucket: string;
  region: string;
  path: string | null;
  endpoint: string | null;
  public_url: string | null;
}

export interface Catalog {
  id: string;
  name: string;
  storage: string;
  writable: boolean;
  media: number;
}

export interface Person {
  id: string;
  name: string;
  catalog: string;
}

export interface Tag {
  id: string;
  parent: string | null;
  name: string;
  catalog: string;
}

export interface Album {
  id: string;
  parent: string | null;
  name: string;
  catalog: string;
  media: number;
}

export type FieldQuery<F> = Operator & {
  type: "field";
  invert?: boolean;
  field: F;
  modifier?: Modifier;
};

export type RelationQueryItem<F> =
  | FieldQuery<F>
  | CompoundQuery<RelationQueryItem<F>>;

export interface CompoundQuery<I = CompoundQueryItem> {
  type: "compound";
  invert?: boolean;
  join?: Join;
  queries: I[];
}

export type RelationCompoundQuery<R extends keyof RelationFields> =
  CompoundQuery<RelationQueryItem<RelationFields[R]>>;

export type RelationQuery<
  R extends keyof RelationFields = keyof RelationFields,
> = Replace<
  RelationCompoundQuery<R>,
  {
    type: R;
    recursive?: boolean;
  }
>;

export type SearchQuery = Omit<CompoundQuery, "type">;

export type CompoundQueryItem =
  | FieldQuery<MediaField>
  | RelationQuery<"tag">
  | RelationQuery<"person">
  | RelationQuery<"album">
  | CompoundQuery;

export interface SavedSearch {
  id: string;
  name: string;
  shared: boolean;
  query: SearchQuery;
  catalog: string;
  media: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string | null;
}

export type State = User & {
  storage: Storage[];
  catalogs: Catalog[];
  people: Person[];
  tags: Tag[];
  albums: Album[];
  searches: SavedSearch[];
};

export type Operator =
  | { operator: "empty" }
  | { operator: "equal"; value: string | number }
  | { operator: "lessthan"; value: string | number }
  | { operator: "lessthanequal"; value: string | number }
  | { operator: "contains"; value: string }
  | { operator: "startswith"; value: string }
  | { operator: "endswith"; value: string }
  | { operator: "matches"; value: string };

export enum Modifier {
  Length = "length",
  Year = "year",
  Month = "month",
  Day = "day",
  DayOfWeek = "dayofweek",
}

export enum Join {
  And = "&&",
  Or = "||",
}

export enum MediaField {
  Title = "title",
  Filename = "filename",
  Description = "description",
  Category = "category",
  Label = "label",
  Location = "location",
  City = "city",
  State = "state",
  Country = "country",
  Make = "make",
  Model = "model",
  Lens = "lens",
  Photographer = "photographer",
  ShutterSpeed = "shutterSpeed",
  Longitude = "longitude",
  Latitude = "latitude",
  Altitude = "altitude",
  Orientation = "orientation",
  Aperture = "aperture",
  Iso = "iso",
  FocalLength = "focalLength",
  Rating = "rating",
  Taken = "taken",
  TakenZone = "takenZone",
}

export enum TagField {
  Id = "id",
  Name = "name",
}

export enum PersonField {
  Id = "id",
  Name = "name",
}

export enum AlbumField {
  Id = "id",
  Name = "name",
}

export interface RelationFields {
  album: AlbumField;
  tag: TagField;
  person: PersonField;
}

export enum AlternateFileType {
  Thumbnail = "thumbnail",
  Reencode = "reencode",
  Social = "social",
}

export interface MediaViewFileAlternate {
  type: AlternateFileType;
  mimetype: string;
  width: number;
  height: number;
}

export interface MediaViewFile {
  id: string;
  fileSize: number;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  frameRate: number | null;
  bitRate: number | null;
  uploaded: DateTime;
  fileName: string;
  alternates: MediaViewFileAlternate[];
}

export enum Orientation {
  TopLeft = 1,
  TopRight = 2,
  BottomRight = 3,
  BottomLeft = 4,
  LeftTop = 5,
  RightTop = 6,
  RightBottom = 7,
  LeftBottom = 8,
}

export enum SourceType {
  Lightroom = "lightroom",
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
}

export interface MediaView {
  id: string;
  catalog: string;
  created: DateTime;
  datetime: DateTime;
  public: boolean;
  filename: string | null;
  title: string | null;
  description: string | null;
  label: string | null;
  category: string | null;
  taken: DateTime | null;
  takenZone: string | null;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  orientation: Orientation | null;
  make: string | null;
  model: string | null;
  lens: string | null;
  photographer: string | null;
  aperture: number | null;
  shutterSpeed: number | null;
  iso: number | null;
  focalLength: number | null;
  rating: number | null;
  file: MediaViewFile | null;
  source: Source | null;
}

export type ApiMediaView = Replace<
  MediaView,
  {
    created: string;
    datetime: string;
    taken: string | null;
    file: ApiMediaViewFile | null;
  }
>;

export type ApiMediaViewFile = Replace<MediaViewFile, { uploaded: string }>;

interface Location {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Relation {
  id?: string | null;
  name: string;
}

export type PersonRelation = Relation & {
  location: Location | null;
};

interface Relations {
  access?: "writableCatalog" | "readableCatalog" | "publicSearch";
  albums: Relation[];
  tags: Relation[];
  searches: Relation[];
  people: PersonRelation[];
}

export type MediaRelations = MediaView & Relations;
export type ApiMediaRelations = ApiMediaView & Relations;

export interface ApiResponse {
  message: string;
}
