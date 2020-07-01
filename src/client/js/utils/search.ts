import { Reference, Catalog } from "../api/highlevel";

export enum Join {
  And = "&&",
  Or = "||",
}

export enum Field {
  Album = "album",
  Tag = "tag",
  Person = "person",
}

export enum Operation {
  Includes = "child",
  IsAncestor = "descendant",
}

export interface FieldQuery {
  invert: boolean;
  field: Field;
  operation: Operation;
  value: string;
}

export interface QueryGroup {
  invert: boolean;
  join: Join;
  queries: Query[];
}

type Query = QueryGroup | FieldQuery;

export interface Search {
  catalog: Reference<Catalog>;
  query?: Query;
}

export function isFieldQuery(f: Query): f is FieldQuery {
  return !("join" in f);
}
