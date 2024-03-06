import { useCallback } from "react";

import Icon, { IconName } from "./Icon";
import {
  AlbumField,
  CompoundQuery,
  CompoundQueryItem,
  FieldQuery,
  MediaField,
  Modifier,
  Operator,
  PersonField,
  RelationCompoundQuery,
  RelationFields,
  RelationQuery,
  RelationQueryItem,
  SearchQuery,
  State,
  TagField,
} from "../modules/types";

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

function CompoundOuter({
  query,
  icon,
  children,
}: {
  query:
    | Omit<CompoundQuery, "type" | "queries">
    | Omit<RelationQuery, "type" | "queries">;
  icon?: IconName;
  children: React.ReactNode;
}): React.ReactNode {
  if (query.invert) {
    return (
      <div className="compound">
        {icon && (
          <div className="icon">
            <Icon icon={icon} />
          </div>
        )}{" "}
        <div className="modifier">not</div>
        {children}
      </div>
    );
  }

  return (
    <div className="compound">
      {icon && (
        <div className="icon">
          <Icon icon={icon} />
        </div>
      )}{" "}
      {children}
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
                // @ts-ignore
                query={fieldQuery}
                serverState={serverState}
              />
            );
          case "album":
            return (
              <AlbumFieldDescription
                // @ts-ignore
                query={fieldQuery}
                serverState={serverState}
              />
            );
          case "tag":
            return (
              <TagFieldDescription
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
        return (
          <RelationCompoundDescription
            relation={relation}
            query={fieldQuery}
            serverState={serverState}
          />
        );
      }

      return null;
    },
    [relation, serverState],
  );

  return (
    <CompoundOuter icon={relation} query={query}>
      {query.queries.map(renderQuery)}
    </CompoundOuter>
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
        return <FieldDescription query={fieldQuery} />;
      }

      if (fieldQuery.type == "compound") {
        return (
          <CompoundDescription query={fieldQuery} serverState={serverState} />
        );
      }

      if (isRelation(fieldQuery.type)) {
        return (
          <RelationCompoundDescription
            relation={fieldQuery.type}
            query={fieldQuery}
            serverState={serverState}
          />
        );
      }

      return null;
    },
    [serverState],
  );

  return (
    <CompoundOuter query={query}>
      {query.queries.map(renderQuery)}
    </CompoundOuter>
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
      <CompoundDescription query={query} serverState={serverState} />
    </div>
  );
}
