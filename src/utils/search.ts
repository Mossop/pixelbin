import moment from "moment-timezone";
import { JsonDecoder } from "ts.data.json";

import {
  Search,
  MetadataColumns,
  Modifier,
  Operator,
  ModifierResult,
  Join,
  AllowedOperators,
  RelationType,
  RelationFields,
  MediaFields,
} from "../model";
import { DateDecoder, MappingDecoder } from "./decoders";

function buildFieldDecoder(): JsonDecoder.Decoder<string> {
  let fieldNames = Object.keys(MediaFields).concat(Object.keys(RelationFields));
  let decoders = fieldNames.map(
    (name: string): JsonDecoder.Decoder<string> => JsonDecoder.isExactly(name),
  );

  return JsonDecoder.oneOf(decoders, "field");
}

const FieldDecoder = buildFieldDecoder();

const FieldQueryDecoder = MappingDecoder(
  JsonDecoder.object<Search.FieldQuery>({
    invert: JsonDecoder.boolean,
    type: JsonDecoder.isExactly("field"),
    field: FieldDecoder,
    modifier: JsonDecoder.nullable(
      JsonDecoder.enumeration<Search.Modifier>(Modifier, "Modifier"),
    ),
    operator: JsonDecoder.enumeration<Search.Operator>(Operator, "Operator"),
    value: JsonDecoder.optional(JsonDecoder.oneOf<Search.FieldQuery["value"]>([
      JsonDecoder.string,
      JsonDecoder.number,
      DateDecoder,
      JsonDecoder.isExactly(null),
      JsonDecoder.isExactly(undefined),
    ], "value")),
  }, "FieldQuery"),
  (query: Search.FieldQuery): Search.FieldQuery => {
    let fieldType: Search.FieldType;
    if (query.modifier) {
      fieldType = ModifierResult[query.modifier];
    } else {
      fieldType = MetadataColumns[query.field];
    }

    let expectedValueType: Search.ValueType = AllowedOperators[fieldType][query.operator];
    if (expectedValueType == "date" && typeof query.value == "string") {
      query.value = moment(query.value);
    }

    return query;
  },
  "FieldQuery",
);

const CompoundJoinDecoder = JsonDecoder.enumeration<Join>(Join, "CompoundJoin");

const CompoundQueryDecoder = JsonDecoder.lazy(() => JsonDecoder.object<Search.CompoundQuery>({
  invert: JsonDecoder.boolean,
  type: JsonDecoder.isExactly("compound"),
  relation: JsonDecoder.optional(
    JsonDecoder.nullable(
      JsonDecoder.enumeration<RelationType>(RelationType, "RelationType"),
    ),
  ),
  join: CompoundJoinDecoder,
  queries: JsonDecoder.array(QueryDecoder, "Query[]"),
}, "CompoundQuery"));

const QueryDecoder: JsonDecoder.Decoder<Search.Query> = JsonDecoder.oneOf<Search.Query>([
  FieldQueryDecoder,
  CompoundQueryDecoder,
], "Query");

export const SearchDecoder: JsonDecoder.Decoder<Search.Search> = JsonDecoder.combine(
  JsonDecoder.object({
    catalog: JsonDecoder.string,
  }, "catalog"),
  QueryDecoder,
);
