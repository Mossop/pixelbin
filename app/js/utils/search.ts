import { Catalog } from "../api/types";

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

export interface Query {
  field?: FieldQuery;
  group?: QueryGroup;
}

export interface Search {
  catalog: Catalog;
  query: QueryGroup;
}

export function isFieldQuery(f: FieldQuery | QueryGroup): f is FieldQuery {
  return !("join" in f);
}
