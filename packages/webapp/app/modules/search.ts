import { useMemo } from "react";

import { useServerState } from "./client-util";
import {
  AlbumField,
  CompoundQuery,
  FieldQuery,
  Join,
  MediaField,
  Modifier,
  Operator,
  PersonField,
  RelationCompoundQuery,
  RelationFields,
  RelationQuery,
  SearchQuery,
  State,
  TagField,
} from "./types";

function isPart(st: string | null): st is string {
  return !!st;
}

function isRelation(str: string): str is keyof RelationFields {
  return str == "tag" || str == "person" || str == "tag";
}

function withModifier(name: string, modifier: Modifier | undefined): string {
  switch (modifier) {
    case Modifier.Length:
      return `length(${name})`;
    case Modifier.Month:
      return `month(${name})`;
    case Modifier.Year:
      return `year(${name})`;
    default:
      return name;
  }
}

function operatorText(
  operator: Operator,
  invert: boolean | undefined,
  overrideValue: string | undefined,
) {
  let actualValue = (opValue: string | number) => {
    let toShow = overrideValue ?? opValue;
    if (typeof toShow == "string") {
      return `"${toShow}"`;
    }
    return toShow;
  };

  switch (operator.operator) {
    case "equal":
      return `${invert ? "!=" : "=="} ${actualValue(operator.value)}`;
    case "lessthan":
      return `${invert ? ">=" : "<"} ${actualValue(operator.value)}`;
    case "lessthanequal":
      return `${invert ? ">" : "<="} ${actualValue(operator.value)}`;
    case "contains":
      return `${invert ? "doesn't contain" : "contains"} ${actualValue(operator.value)}`;
    case "endswith":
      return `${invert ? "doesn't end with" : "ends with"} ${actualValue(operator.value)}`;
    case "startswith":
      return `${invert ? "doesn't start with" : "starts with"} ${actualValue(operator.value)}`;
    case "matches":
      return `${invert ? "doesn't match" : "matches"} ${actualValue(operator.value)}`;
    default:
      return IntersectionObserverEntry ? "isn't empty" : "is empty";
  }
}

function innerFieldDescription<F>(
  query: Omit<FieldQuery<F>, "field"> & Operator,
  fieldName: string,
  overrideValue?: string,
): string {
  return `${withModifier(fieldName, query.modifier)} ${operatorText(query, query.invert, overrideValue)}`;
}

function fieldDescription(query: FieldQuery<MediaField>): string {
  return innerFieldDescription(query, query.field);
}

function personFieldDescription(
  query: FieldQuery<PersonField>,
  serverState: State,
): string {
  let override: string | undefined;
  if ("value" in query && typeof query.value == "string") {
    let person = serverState.people.find((p) => p.id == query.value);
    override = person?.name;
  }

  return innerFieldDescription(query, "person", override);
}

function tagFieldDescription(
  query: FieldQuery<TagField>,
  serverState: State,
): string {
  let override: string | undefined;
  if ("value" in query && typeof query.value == "string") {
    let tag = serverState.tags.find((t) => t.id == query.value);
    override = tag?.name;
  }

  return innerFieldDescription(query, "tag", override);
}

function albumFieldDescription(
  query: FieldQuery<AlbumField>,
  serverState: State,
): string {
  let override: string | undefined;
  if ("value" in query && typeof query.value == "string") {
    let album = serverState.albums.find((a) => a.id == query.value);
    override = album?.name;
  }

  return innerFieldDescription(query, "album", override);
}

function compoundOuter(
  query:
    | Omit<CompoundQuery, "type" | "queries">
    | Omit<RelationQuery, "type" | "queries">,
  parts: string[],
): string | null {
  if (parts.length == 0) {
    return null;
  }

  let result = parts[0];
  if (parts.length > 1) {
    result = parts
      .map((p) => `(${p})`)
      .join(query.join == Join.Or ? " or " : " and ");
  }

  if (query.invert) {
    return `not (${result})`;
  }
  return result;
}

function relationCompoundDescription<R extends keyof RelationFields>(
  relation: R,
  query: Omit<RelationCompoundQuery<R>, "type">,
  serverState: State,
): string | null {
  let parts = query.queries
    .map((q): string | null => {
      if (q.type == "field") {
        switch (relation) {
          case "person":
            // @ts-ignore
            return personFieldDescription(q, serverState);
          case "album":
            // @ts-ignore
            return albumFieldDescription(q, serverState);
          case "tag":
            // @ts-ignore
            return tagFieldDescription(q, serverState);
          default:
            return null;
        }
      }

      if (q.type == "compound") {
        return relationCompoundDescription(relation, q, serverState);
      }

      return null;
    })
    .filter(isPart);

  return compoundOuter(query, parts);
}

function compoundDescription(
  query: Omit<CompoundQuery, "type">,
  serverState: State,
): string | null {
  let parts = query.queries
    .map((q): string | null => {
      if (q.type == "field") {
        return fieldDescription(q);
      }

      if (q.type == "compound") {
        return compoundDescription(q, serverState);
      }

      if (isRelation(q.type)) {
        return relationCompoundDescription(q.type, q, serverState);
      }

      return null;
    })
    .filter(isPart);

  return compoundOuter(query, parts);
}

export function useSearchDescription(query: SearchQuery): string | null {
  let serverState = useServerState();

  return useMemo(() => {
    if (!serverState) {
      return null;
    }

    return compoundDescription(query, serverState);
  }, [serverState, query]);
}
