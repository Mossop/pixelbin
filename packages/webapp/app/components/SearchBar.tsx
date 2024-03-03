import { useCallback, useState } from "react";

import Icon, { IconButton } from "./Icon";
import { useServerState } from "@/modules/client-util";
import { useSearchDescription } from "@/modules/search";
import { CompoundQuery, Join, SearchQuery, State } from "@/modules/types";

function Compound<T extends Omit<CompoundQuery, "type">>({
  query,
  serverState,
  setQuery,
}: {
  query: Omit<CompoundQuery, "type">;
  serverState: State;
  setQuery: (query: T) => void;
}) {
  return (
    <div className="compound">
      <p className="description">
        {query.invert ? "Doesn't match" : "Matches"}{" "}
        {query.join == Join.Or ? "any of" : "all of"}:
      </p>
      <ul>
        {query.queries.map((q, idx) => (
          <li key={idx}>Hello</li>
        ))}
      </ul>
    </div>
  );
}

export default function SearchBar({
  searchQuery,
  setQuery,
}: {
  searchQuery: SearchQuery;
  setQuery: (query: SearchQuery) => void;
}) {
  let serverState = useServerState();
  let description = useSearchDescription(searchQuery);
  let [expanded, setExpanded] = useState(false);

  let expand = useCallback(() => setExpanded(true), []);
  let collapse = useCallback(() => setExpanded(false), []);

  if (!serverState) {
    return null;
  }

  return (
    <div className="c-searchbar">
      <Icon icon="search" />
      <div className="query">
        {expanded ? (
          <Compound
            query={searchQuery}
            setQuery={setQuery}
            serverState={serverState}
          />
        ) : (
          <p className="description">{description}</p>
        )}
      </div>
      <div className="expander">
        {expanded ? (
          <IconButton icon="collapse" onClick={collapse} />
        ) : (
          <IconButton icon="expand" onClick={expand} />
        )}
      </div>
    </div>
  );
}
