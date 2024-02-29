import clsx from "clsx";
import { useCallback, useState } from "react";

import Icon, { IconButton } from "./Icon";
import { useSearchDescription } from "@/modules/search";
import { SearchQuery } from "@/modules/types";

export default function SearchBar({
  searchQuery,
}: {
  searchQuery: SearchQuery;
}) {
  let description = useSearchDescription(searchQuery);
  let [expanded, setExpanded] = useState(false);

  let expand = useCallback(() => setExpanded(true), []);
  let collapse = useCallback(() => setExpanded(false), []);

  return (
    <div className="c-searchbar">
      <div className="header">
        <div className="description">
          <Icon icon="search" />
          {description}
        </div>
        <div className="expander">
          {expanded ? (
            <IconButton icon="collapse" onClick={collapse} />
          ) : (
            <IconButton icon="expand" onClick={expand} />
          )}
        </div>
      </div>
      <div className={clsx("query", expanded ? "expanded" : "collapsed")}></div>
    </div>
  );
}
