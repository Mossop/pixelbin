export interface User {
  email: string;
  fullname?: string;
  administrator: boolean;
  created: string;
  last_login: string;
  verified?: boolean;
}

export interface Storage {
  id: string;
  name: string;
  bucket: string;
  region: string;
  path?: string;
  endpoint?: string;
  public_url?: string;
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
  parent?: string;
  name: string;
  catalog: string;
}

export interface Album {
  id: string;
  parent?: string;
  name: string;
  catalog: string;
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
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
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
