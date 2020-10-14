import { Draft } from "immer";
import { JsonDecoder } from "ts.data.json";

import {
  Search,
  Modifier,
  Operator,
  ModifierResult,
  Join,
  AllowedOperators,
  RelationType,
  RelationFields,
  MediaFields,
} from "../model";
import { parseDateTime } from "./datetime";
import { DateDecoder, decode, MappingDecoder, oneOf } from "./decoders";

function FieldQueryDecoder(relation: RelationType | null): JsonDecoder.Decoder<Search.FieldQuery> {
  return MappingDecoder(
    JsonDecoder.object<Search.FieldQuery>({
      invert: JsonDecoder.boolean,
      type: JsonDecoder.isExactly("field"),
      field: JsonDecoder.string,
      modifier: JsonDecoder.nullable(
        JsonDecoder.enumeration<Modifier>(Modifier, "Modifier"),
      ),
      operator: JsonDecoder.enumeration<Operator>(Operator, "Operator"),
      value: JsonDecoder.optional(oneOf<Search.FieldQuery["value"]>([
        JsonDecoder.string,
        JsonDecoder.number,
        DateDecoder,
        JsonDecoder.isExactly(null),
        JsonDecoder.isExactly(undefined),
      ], "value")),
    }, "FieldQuery"),
    (query: Draft<Search.FieldQuery>): Search.FieldQuery => {
      let validFields = relation ? RelationFields : MediaFields;

      if (!(query.field in validFields)) {
        throw new Error(`${query.field} is not a known field.`);
      }

      let fieldType: Search.FieldType;
      if (query.modifier) {
        if (!(query.modifier in ModifierResult)) {
          throw new Error(`${query.modifier} is not a valid field modifier.`);
        }
        fieldType = ModifierResult[query.modifier];
      } else {
        fieldType = validFields[query.field];
      }

      let expectedValueType: Search.ValueType = AllowedOperators[fieldType][query.operator];
      if (expectedValueType == "date" && typeof query.value == "string") {
        query.value = parseDateTime(query.value);
      }

      return query;
    },
    "FieldQuery",
  );
}

const JoinDecoder = JsonDecoder.enumeration<Join>(Join, "Join");

type BaseCompoundQuery = Omit<Search.CompoundQuery, "queries"> & {
  queries: unknown[];
};

const BaseCompoundQueryDecoder = JsonDecoder.object<BaseCompoundQuery>({
  invert: JsonDecoder.boolean,
  type: JsonDecoder.isExactly("compound"),
  join: JoinDecoder,
  queries: JsonDecoder.array(JsonDecoder.succeed, "any[]"),
}, "BaseCompoundQuery");

function CompoundQueryDecoder(
  relation: RelationType | null,
): JsonDecoder.Decoder<Search.CompoundQuery> {
  return MappingDecoder(
    BaseCompoundQueryDecoder,
    (base: BaseCompoundQuery): Search.CompoundQuery => {
      let queryDecoders: JsonDecoder.Decoder<Search.Query>[] = [
        FieldQueryDecoder(relation),
        CompoundQueryDecoder(relation),
      ];

      if (!relation) {
        queryDecoders.push(RelationQueryDecoder);
      }

      return {
        ...base,
        queries: decode(
          JsonDecoder.array(oneOf(queryDecoders, "Query"), "Query[]"),
          base.queries,
        ),
      };
    },
    "CompoundQuery",
  );
}

type BaseRelationQuery = Omit<Search.RelationQuery, "queries"> & {
  queries: unknown[];
};

const RelationQueryDecoder = MappingDecoder(
  JsonDecoder.combine(
    BaseCompoundQueryDecoder,
    JsonDecoder.object({
      relation: JsonDecoder.enumeration<RelationType>(RelationType, "RelationType"),
      recursive: JsonDecoder.boolean,
    }, "RelationQuery"),
  ),
  (base: BaseRelationQuery): Search.RelationQuery => {
    return {
      ...base,
      queries: decode(
        JsonDecoder.array(oneOf<Search.FieldQuery | Search.CompoundQuery>([
          FieldQueryDecoder(base.relation),
          CompoundQueryDecoder(base.relation),
        ], "Query"), "Query[]"),
        base.queries,
      ),
    };
  },
  "CompoundQuery",
);

export const QueryDecoder: JsonDecoder.Decoder<Search.Query> = oneOf<Search.Query>([
  FieldQueryDecoder(null),
  CompoundQueryDecoder(null),
  RelationQueryDecoder,
], "Query");
