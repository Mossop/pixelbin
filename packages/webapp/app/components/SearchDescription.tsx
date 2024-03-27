import { useCallback } from "react";

import Chip from "./Chip";
import {
  AlbumField,
  CompoundQuery,
  CompoundQueryItem,
  FieldQuery,
  Join,
  MediaField,
  Modifier,
  Operator,
  PersonField,
  RelationCompoundQuery,
  RelationFields,
  RelationQueryItem,
  SearchQuery,
  State,
  TagField,
} from "../modules/types";
import { keyFor } from "@/modules/client-util";

import "styles/components/SearchDescription.scss";

function isRelation(str: string): str is keyof RelationFields {
  return str == "tag" || str == "person" || str == "tag";
}

function joined(
  nodes: React.ReactNode[],
  join: Join | null | undefined,
): React.ReactNode[] {
  if (!nodes.length) {
    return nodes;
  }

  let results = [nodes[0]];

  for (let i = 1; i < nodes.length; i++) {
    let key = keyFor({});
    results.push(
      join == Join.Or ? <span key={key}>or</span> : <span key={key}>and</span>,
    );
    results.push(nodes[i]);
  }

  return results;
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

function FieldDescription({
  query,
}: {
  query: FieldQuery<MediaField>;
}): React.ReactNode {
  return innerFieldDescription(query, query.field);
}

function PersonFieldDescription({
  query,
  serverState,
}: {
  query: FieldQuery<PersonField>;
  serverState: State;
}): React.ReactNode {
  let override: string | undefined;
  if ("value" in query && typeof query.value == "string") {
    let person = serverState.people.find((p) => p.id == query.value);
    override = person?.name;
  }

  return (
    <div className="field">
      {innerFieldDescription(query, "person", override)}
    </div>
  );
}

function TagFieldDescription({
  query,
  serverState,
}: {
  query: FieldQuery<TagField>;
  serverState: State;
}): React.ReactNode {
  let override: string | undefined;
  if ("value" in query && typeof query.value == "string") {
    let tag = serverState.tags.find((t) => t.id == query.value);
    override = tag?.name;
  }

  return (
    <div className="field">{innerFieldDescription(query, "tag", override)}</div>
  );
}

function AlbumFieldDescription({
  query,
  serverState,
}: {
  query: FieldQuery<AlbumField>;
  serverState: State;
}): React.ReactNode {
  let override: string | undefined;
  if ("value" in query && typeof query.value == "string") {
    let album = serverState.albums.find((a) => a.id == query.value);
    override = album?.name;
  }

  return (
    <div className="field">
      {innerFieldDescription(query, "album", override)}
    </div>
  );
}

function RelationCompoundDescription<R extends keyof RelationFields>({
  relation,
  query,
  serverState,
}: {
  relation: R;
  query: Omit<RelationCompoundQuery<R>, "type">;
  serverState: State;
}): React.ReactNode {
  let renderQuery = useCallback(
    (fieldQuery: RelationQueryItem<RelationFields[R]>) => {
      if (fieldQuery.type == "field") {
        switch (relation) {
          case "person":
            return (
              <PersonFieldDescription
                key={keyFor(fieldQuery)}
                // @ts-ignore
                query={fieldQuery}
                serverState={serverState}
              />
            );
          case "album":
            return (
              <AlbumFieldDescription
                key={keyFor(fieldQuery)}
                // @ts-ignore
                query={fieldQuery}
                serverState={serverState}
              />
            );
          case "tag":
            return (
              <TagFieldDescription
                key={keyFor(fieldQuery)}
                // @ts-ignore
                query={fieldQuery}
                serverState={serverState}
              />
            );
          default:
            return null;
        }
      }

      if (fieldQuery.type == "compound") {
        if (
          fieldQuery.invert == query.invert &&
          fieldQuery.join == query.join
        ) {
          return (
            <RelationCompoundDescription
              key={keyFor(fieldQuery)}
              relation={relation}
              query={fieldQuery}
              serverState={serverState}
            />
          );
        }

        return (
          <Chip
            key={keyFor(fieldQuery)}
            variant={fieldQuery.invert ? "danger" : "success"}
          >
            <RelationCompoundDescription
              relation={relation}
              query={fieldQuery}
              serverState={serverState}
            />
          </Chip>
        );
      }

      return null;
    },
    [relation, serverState, query],
  );

  return (
    <div className="compound">
      {joined(query.queries.map(renderQuery), query.join)}
    </div>
  );
}

function CompoundDescription({
  query,
  serverState,
}: {
  query: Omit<CompoundQuery, "type">;
  serverState: State;
}): React.ReactNode {
  let renderQuery = useCallback(
    (fieldQuery: CompoundQueryItem) => {
      if (fieldQuery.type == "field") {
        return <FieldDescription key={keyFor(fieldQuery)} query={fieldQuery} />;
      }

      if (fieldQuery.type == "compound") {
        if (
          fieldQuery.invert == query.invert &&
          fieldQuery.join == query.join
        ) {
          return (
            <CompoundDescription
              key={keyFor(fieldQuery)}
              query={fieldQuery}
              serverState={serverState}
            />
          );
        }

        return (
          <div key={keyFor(fieldQuery)} className="innerCompound">
            <Chip variant={fieldQuery.invert ? "danger" : "success"}>
              <CompoundDescription
                query={fieldQuery}
                serverState={serverState}
              />
            </Chip>
          </div>
        );
      }

      if (isRelation(fieldQuery.type)) {
        return (
          <div key={keyFor(fieldQuery)} className="innerCompound">
            <Chip
              icon={fieldQuery.type}
              variant={fieldQuery.invert ? "danger" : "success"}
            >
              <RelationCompoundDescription
                relation={fieldQuery.type}
                query={fieldQuery}
                serverState={serverState}
              />
            </Chip>
          </div>
        );
      }

      return null;
    },
    [serverState, query],
  );

  return (
    <div className="compound">
      {joined(query.queries.map(renderQuery), query.join)}
    </div>
  );
}

export function SearchDescription({
  query,
  serverState,
}: {
  query: SearchQuery;
  serverState: State;
}) {
  return (
    <div className="c-search-description">
      <Chip icon="search" variant={query.invert ? "danger" : "success"}>
        <CompoundDescription query={query} serverState={serverState} />
      </Chip>
    </div>
  );
}
