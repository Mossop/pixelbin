import { isMoment } from "moment-timezone";

import { RelationType } from "./api";
import { Date, MetadataColumns } from "./models";

export type FieldType = "number" | "string" | "date";

export const MediaFields = {
  ...MetadataColumns,
};

export const RelationFields = {
  id: "string",
  name: "string",
};

export enum Modifier {
  Length = "length",
  Year = "year",
  Month = "month",
}

export const ModifierResult: Record<Modifier, FieldType> = {
  [Modifier.Length]: "number",
  [Modifier.Year]: "number",
  [Modifier.Month]: "number",
};

export enum Operator {
  Empty = "empty",
  Equal = "equal",
  LessThan = "lessthan",
  LessThanOrEqual = "lessthanequal",
  Contains = "contains",
  StartsWith = "startswith",
  EndsWith = "endswith",
  Matches = "matches",
}

export const AllowedModifiers: Record<FieldType, (Modifier | null)[]> = {
  string: [null, Modifier.Length],
  number: [null],
  date: [null, Modifier.Year, Modifier.Month],
};

export type ValueType = FieldType | null;
export const AllowedOperators = {
  string: {
    [Operator.Empty]: null,
    [Operator.Equal]: "string",
    [Operator.Contains]: "string",
    [Operator.StartsWith]: "string",
    [Operator.EndsWith]: "string",
    [Operator.Matches]: "string",
  },
  number: {
    [Operator.Empty]: null,
    [Operator.Equal]: "number",
    [Operator.LessThan]: "number",
    [Operator.LessThanOrEqual]: "number",
  },
  date: {
    [Operator.Empty]: null,
    [Operator.Equal]: "date",
    [Operator.LessThan]: "date",
    [Operator.LessThanOrEqual]: "date",
  },
};

interface BaseQuery {
  invert: boolean;
}

export interface FieldQuery extends BaseQuery {
  type: "field",
  field: string,
  modifier: Modifier | null;
  operator: Operator;
  value?: string | number | Date | null | undefined;
}

export function isFieldQuery(query: Query): query is FieldQuery {
  return query.type == "field";
}

export enum Join {
  And = "&&",
  Or = "||",
}

export interface CompoundQuery extends BaseQuery {
  type: "compound",
  relation?: RelationType | null,
  recursive?: boolean,
  join: Join,
  queries: Query[];
}

export type Query = FieldQuery | CompoundQuery;

export function isCompoundQuery(query: Query): query is CompoundQuery {
  return query.type == "compound";
}

export type Search = Query & {
  catalog: string;
};

export function checkQuery(query: Query | Search, inRelated: boolean = false): void {
  if (isCompoundQuery(query)) {
    if (query.relation && inRelated) {
      throw new Error(
        `Cannot query the related table ${query.relation} when already querying a related table.`,
      );
    }

    for (let q of query.queries) {
      checkQuery(q, inRelated || Boolean(query.relation));
    }
  } else {
    let validFields = inRelated ? RelationFields : MediaFields;

    if (!(query.field in validFields)) {
      throw new Error(`Field '${query.field}' is unknown.`);
    }

    let fieldType = validFields[query.field];
    if (!AllowedModifiers[fieldType].includes(query.modifier)) {
      throw new Error(
        `Cannot apply the '${query.modifier}' modifier to a '${fieldType}' field.`,
      );
    }
    if (query.modifier) {
      fieldType = ModifierResult[query.modifier];
    }

    if (!(query.operator in AllowedOperators[fieldType])) {
      throw new Error(`Cannot apply operator '${query.operator}' to a '${fieldType}' value.`);
    }

    let expectedValueType = AllowedOperators[fieldType][query.operator];
    if (expectedValueType === null) {
      if (query.value !== null && query.value !== undefined) {
        throw new Error(`Expected no value for operator '${query.operator}'.`);
      }
    } else if (expectedValueType == "date") {
      if (!isMoment(query.value)) {
        throw new Error(
          `Expected a '${expectedValueType}' value for operator ` +
        `'${query.operator}' but got '${typeof query.value}'.`,
        );
      }
    } else if (expectedValueType != typeof query.value) {
      throw new Error(
        `Expected a '${expectedValueType}' value for operator ` +
        `'${query.operator}' but got '${typeof query.value}'.`,
      );
    }
  }
}
