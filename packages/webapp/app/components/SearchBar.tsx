import clsx from "clsx";
import { Dispatch, useCallback, useEffect, useState } from "react";

import Icon, { IconButton } from "./Icon";
import { useServerState } from "@/modules/client-util";
import { useSearchDescription } from "@/modules/search";
import {
  AlbumField,
  CompoundQuery,
  CompoundQueryItem,
  Join,
  PersonField,
  RelationQueryItem,
  SearchQuery,
  State,
  TagField,
} from "@/modules/types";

const hashes = new WeakMap<object, string>();
let currentId = 0;
function hash(query: object): string {
  let existing = hashes.get(query);
  if (existing) {
    return existing;
  }

  existing = `Q${currentId++}`;
  hashes.set(query, existing);
  return existing;
}

type ItemRenderer<I> = (props: {
  item: I;
  setItem: Dispatch<I>;
  deleteItem?: () => void;
  serverState: State;
}) => React.ReactNode;

function CompoundHeader<I, T extends Omit<CompoundQuery<I>, "type">>({
  query,
  setQuery,
}: {
  query: T;
  setQuery: (query: T) => void;
}) {
  let toggleInverted = useCallback(() => {
    setQuery({
      ...query,
      invert: !query.invert,
    });
  }, [setQuery, query]);

  let selectAnd = useCallback(() => {
    setQuery({
      ...query,
      join: Join.And,
    });
  }, [setQuery, query]);

  let selectOr = useCallback(() => {
    setQuery({
      ...query,
      join: Join.Or,
    });
  }, [setQuery, query]);

  return (
    <div className="toggles">
      <button
        type="button"
        className={clsx("toggle", "invert", query.invert && "selected")}
        onClick={toggleInverted}
      >
        NOT
      </button>
      <label className={clsx("toggle", query.join != Join.Or && "selected")}>
        <input
          type="radio"
          name="join"
          value="and"
          checked={query.join != Join.Or}
          onChange={selectAnd}
        />
        AND
      </label>
      <label className={clsx("toggle", query.join == Join.Or && "selected")}>
        <input
          type="radio"
          name="join"
          value="or"
          checked={query.join == Join.Or}
          onChange={selectOr}
        />
        OR
      </label>
    </div>
  );
}

function QueryItem<I, T extends Omit<CompoundQuery<I>, "type">>({
  compound,
  setCompound,
  item,
  serverState,
  renderer,
}: {
  compound: T;
  setCompound: (query: T) => void;
  item: number;
  serverState: State;
  renderer: ItemRenderer<I>;
}) {
  let deleteItem = useCallback(() => {
    setCompound({
      ...compound,
      queries: [
        ...compound.queries.slice(0, item),
        ...compound.queries.slice(item + 1),
      ],
    });
  }, [compound, item, setCompound]);

  let setItem = useCallback(
    (newItem: I) => {
      setCompound({
        ...compound,
        queries: [
          ...compound.queries.slice(0, item),
          newItem,
          ...compound.queries.slice(item + 1),
        ],
      });
    },
    [compound, item, setCompound],
  );

  return (
    <li>
      {renderer({
        item: compound.queries[item],
        setItem,
        deleteItem,
        serverState,
      })}
    </li>
  );
}

function Compound<I, T extends Omit<CompoundQuery<I>, "type">>({
  query,
  setQuery,
  deleteItem,
  serverState,
  renderer,
}: {
  query: T;
  setQuery: (query: T) => void;
  deleteItem?: () => void;
  serverState: State;
  renderer: ItemRenderer<I>;
}) {
  return (
    <div className="compound">
      <div className="header">
        <CompoundHeader query={query} setQuery={setQuery} />
        {deleteItem && <IconButton icon="delete" onClick={deleteItem} />}
      </div>
      <ul className="queries">
        {query.queries.map((item, index) => (
          <QueryItem
            key={hash(query)}
            compound={query}
            setCompound={setQuery}
            item={index}
            serverState={serverState}
            renderer={renderer}
          />
        ))}
      </ul>
    </div>
  );
}

function RenderTagItem({
  item,
  setItem,
  deleteItem,
  serverState,
}: {
  item: RelationQueryItem<TagField>;
  setItem: Dispatch<RelationQueryItem<TagField>>;
  deleteItem?: () => void;
  serverState: State;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          setQuery={setItem}
          deleteItem={deleteItem}
          renderer={RenderTagItem}
          serverState={serverState}
        />
      );
    default:
      return "hello";
  }
}

function RenderAlbumItem({
  item,
  setItem,
  deleteItem,
  serverState,
}: {
  item: RelationQueryItem<AlbumField>;
  setItem: Dispatch<RelationQueryItem<AlbumField>>;
  deleteItem?: () => void;
  serverState: State;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          setQuery={setItem}
          deleteItem={deleteItem}
          renderer={RenderAlbumItem}
          serverState={serverState}
        />
      );
    default:
      return null;
  }
}

function RenderPersonItem({
  item,
  setItem,
  deleteItem,
  serverState,
}: {
  item: RelationQueryItem<PersonField>;
  setItem: Dispatch<RelationQueryItem<PersonField>>;
  deleteItem?: () => void;
  serverState: State;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          setQuery={setItem}
          deleteItem={deleteItem}
          renderer={RenderPersonItem}
          serverState={serverState}
        />
      );
    default:
      return null;
  }
}

function RenderCompoundQueryItem({
  item,
  setItem,
  deleteItem,
  serverState,
}: {
  item: CompoundQueryItem;
  setItem: Dispatch<CompoundQueryItem>;
  deleteItem?: () => void;
  serverState: State;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          setQuery={setItem}
          renderer={RenderCompoundQueryItem}
          deleteItem={deleteItem}
          serverState={serverState}
        />
      );
    case "album":
      return (
        <Compound
          query={item}
          setQuery={setItem}
          renderer={RenderAlbumItem}
          deleteItem={deleteItem}
          serverState={serverState}
        />
      );
    case "person":
      return (
        <Compound
          query={item}
          setQuery={setItem}
          renderer={RenderPersonItem}
          deleteItem={deleteItem}
          serverState={serverState}
        />
      );
    case "tag":
      return (
        <Compound
          query={item}
          setQuery={setItem}
          renderer={RenderTagItem}
          deleteItem={deleteItem}
          serverState={serverState}
        />
      );
    default:
      return null;
  }
}

export default function SearchBar({
  searchQuery,
}: {
  searchQuery: SearchQuery;
}) {
  let serverState = useServerState();
  let description = useSearchDescription(searchQuery);
  let [expanded, setExpanded] = useState(false);

  let [currentQuery, setCurrentQuery] = useState(searchQuery);

  let expand = useCallback(() => setExpanded(true), []);
  let collapse = useCallback(() => {
    setCurrentQuery(searchQuery);
    setExpanded(false);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentQuery(searchQuery);
  }, [searchQuery]);

  if (!serverState) {
    return null;
  }

  if (!expanded) {
    return (
      <div className="c-searchbar collapsed">
        <Icon icon="search" />
        <p className="query">{description}</p>
        <IconButton icon="expand" onClick={expand} />
      </div>
    );
  }

  return (
    <div className="c-searchbar">
      <Icon icon="search" />
      <div className="query">
        <Compound
          query={currentQuery}
          setQuery={setCurrentQuery}
          renderer={RenderCompoundQueryItem}
          serverState={serverState}
        />
      </div>
      <IconButton icon="collapse" onClick={collapse} />
    </div>
  );
}
