import { DateTime } from "luxon";

export type Replace<A, B> = Omit<A, keyof B> & B;

export interface User {
  email: string;
  fullname: string | null;
  administrator: boolean;
  created: string;
  last_login: string;
  verified: boolean | null;
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
  type: string;
  invert: boolean;
  field: F;
  modifier: Modifier | null;
};

export type RelationQueryItem<R extends string, F> =
  | FieldQuery<F>
  | RelationCompoundQuery<R, F>;

export type RelationCompoundQuery<R extends string, F> = {
  type: "compound";
  relation: R;
  invert: boolean;
  join: Join;
  queries: RelationQueryItem<R, F>[];
};

export interface CompoundQuery {
  type: "compound";
  invert: boolean;
  join: Join;
  queries: CompoundQueryItem[];
}

export type CompoundQueryItem =
  | FieldQuery<MediaField>
  | RelationCompoundQuery<"tag", TagField>
  | RelationCompoundQuery<"person", PersonField>
  | RelationCompoundQuery<"album", AlbumField>
  | CompoundQuery;

export interface SavedSearch {
  id: string;
  name: string;
  shared: boolean;
  query: CompoundQueryItem;
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

export interface MediaViewFile {
  id: string;
  fileSize: number;
  mimetype: string;
  width: number;
  height: number;
  duration: number | null;
  frameRate: number | null;
  bitRate: number | null;
  uploaded: string;
  fileName: string;
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

export interface MediaView {
  id: string;
  catalog: string;
  created: DateTime;
  updated: DateTime;
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
  shutterSpeed: string | null;
  iso: number | null;
  focalLength: number | null;
  rating: number | null;
  file: MediaViewFile | null;
}

export type ApiMediaView = Replace<
  MediaView,
  {
    created: string;
    updated: string;
    taken: string | null;
  }
>;
