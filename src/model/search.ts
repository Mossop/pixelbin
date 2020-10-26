import type { DateTime } from "../utils";
import { RelationType } from "./api";
import { MetadataColumns } from "./models";

export type FieldType = "number" | "string" | "date";

export const MediaFields = {
  ...MetadataColumns,
};

export const RelationFields = {
  name: "string",
  id: "string",
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
  readonly invert: boolean;
}

export interface FieldQuery extends BaseQuery {
  readonly type: "field",
  readonly field: string,
  readonly modifier: Modifier | null;
  readonly operator: Operator;
  readonly value?: string | number | DateTime | null | undefined;
}

export function isFieldQuery(query: Query): query is FieldQuery {
  return query.type == "field";
}

export function allowedFields(relation: RelationType | null): string[] {
  return relation ? Object.keys(RelationFields) : Object.keys(MediaFields);
}

export function allowedModifiers(
  query: FieldQuery,
  relation: RelationType | null,
): (Modifier | null)[] {
  let fields = relation ? RelationFields : MediaFields;
  let fieldType: FieldType = fields[query.field];
  return AllowedModifiers[fieldType];
}

export function allowedOperators(
  query: FieldQuery,
  relation: RelationType | null,
): Operator[] {
  let fieldType: FieldType;
  if (query.modifier) {
    fieldType = ModifierResult[query.modifier];
  } else {
    let fields = relation ? RelationFields : MediaFields;
    fieldType = fields[query.field];
  }

  return Object.keys(AllowedOperators[fieldType]) as Operator[];
}

export function valueType(
  query: FieldQuery,
  relation: RelationType | null,
): FieldType | null {
  let fieldType: FieldType;
  if (query.modifier) {
    fieldType = ModifierResult[query.modifier];
  } else {
    let fields = relation ? RelationFields : MediaFields;
    fieldType = fields[query.field];
  }

  return AllowedOperators[fieldType][query.operator] as FieldType | null;
}

export enum Join {
  And = "&&",
  Or = "||",
}

export interface CompoundQuery extends BaseQuery {
  readonly type: "compound",
  readonly join: Join,
  readonly queries: readonly Query[];
}

export interface RelationQuery extends CompoundQuery {
  readonly relation: RelationType,
  readonly recursive: boolean,
}

export type Query = FieldQuery | CompoundQuery | RelationQuery;

export function isCompoundQuery(query: Query): query is CompoundQuery {
  return query.type == "compound";
}

export function isRelationQuery(query: Query): query is RelationQuery {
  return query.type == "compound" && "relation" in query;
}

export function checkQuery(query: Query, inRelated: boolean = false): void {
  if (isCompoundQuery(query)) {
    let isRelation = isRelationQuery(query);

    if (isRelationQuery(query) && inRelated) {
      throw new Error(
        `Cannot query the related table ${query.relation} when already querying a related table.`,
      );
    }

    for (let q of query.queries) {
      checkQuery(q, inRelated || isRelation);
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
      if (!query.value || typeof query.value != "object") {
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
