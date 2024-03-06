import clsx from "clsx";
import { Dispatch, useCallback, useEffect, useState } from "react";

import Icon, { IconButton } from "./Icon";
import {
  RelationQueryField,
  RenderAlbumChoices,
  RenderPeopleChoices,
  RenderTagChoices,
} from "./QueryFields";
import { SearchDescription } from "@/components/SearchDescription";
import { useServerState, useTimeout } from "@/modules/client-util";
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

type ItemRenderer<I> = (props: {
  item: I;
  setItem: Dispatch<I>;
  deleteItem?: () => void;
  serverState: State;
  catalog: string;
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
  catalog,
  renderer,
}: {
  compound: T;
  setCompound: (query: T) => void;
  item: number;
  serverState: State;
  catalog: string;
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
    <li className="query">
      {renderer({
        item: compound.queries[item],
        setItem,
        deleteItem,
        serverState,
        catalog,
      })}
    </li>
  );
}

function Compound<I, T extends Omit<CompoundQuery<I>, "type">>({
  query,
  setQuery,
  deleteItem,
  serverState,
  catalog,
  renderer,
}: {
  query: T;
  setQuery: (query: T) => void;
  deleteItem?: () => void;
  serverState: State;
  catalog: string;
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
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            compound={query}
            setCompound={setQuery}
            item={index}
            serverState={serverState}
            catalog={catalog}
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
  catalog,
}: {
  item: RelationQueryItem<TagField>;
  setItem: Dispatch<RelationQueryItem<TagField>>;
  deleteItem?: () => void;
  serverState: State;
  catalog: string;
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
          catalog={catalog}
        />
      );
    default:
      return (
        <RelationQueryField
          label="Tag"
          id={TagField.Id}
          name={TagField.Name}
          field={item}
          setField={setItem}
          deleteField={deleteItem}
          choices={
            <RenderTagChoices
              field={item}
              setField={setItem}
              serverState={serverState}
              catalog={catalog}
            />
          }
        />
      );
  }
}

function RenderAlbumItem({
  item,
  setItem,
  deleteItem,
  serverState,
  catalog,
}: {
  item: RelationQueryItem<AlbumField>;
  setItem: Dispatch<RelationQueryItem<AlbumField>>;
  deleteItem?: () => void;
  serverState: State;
  catalog: string;
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
          catalog={catalog}
        />
      );
    default:
      return (
        <RelationQueryField
          label="Album"
          id={AlbumField.Id}
          name={AlbumField.Name}
          field={item}
          setField={setItem}
          deleteField={deleteItem}
          choices={
            <RenderAlbumChoices
              field={item}
              setField={setItem}
              serverState={serverState}
              catalog={catalog}
            />
          }
        />
      );
  }
}

function RenderPersonItem({
  item,
  setItem,
  deleteItem,
  serverState,
  catalog,
}: {
  item: RelationQueryItem<PersonField>;
  setItem: Dispatch<RelationQueryItem<PersonField>>;
  deleteItem?: () => void;
  serverState: State;
  catalog: string;
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
          catalog={catalog}
        />
      );
    default:
      return (
        <RelationQueryField
          label="Person"
          id={PersonField.Id}
          name={PersonField.Name}
          field={item}
          setField={setItem}
          deleteField={deleteItem}
          choices={
            <RenderPeopleChoices
              field={item}
              setField={setItem}
              serverState={serverState}
              catalog={catalog}
            />
          }
        />
      );
  }
}

function RenderCompoundQueryItem({
  item,
  setItem,
  deleteItem,
  serverState,
  catalog,
}: {
  item: CompoundQueryItem;
  setItem: Dispatch<CompoundQueryItem>;
  deleteItem?: () => void;
  serverState: State;
  catalog: string;
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
          catalog={catalog}
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
          catalog={catalog}
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
          catalog={catalog}
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
          catalog={catalog}
        />
      );
    default:
      return null;
  }
}

export default function SearchBar({
  searchQuery,
  setQuery,
  catalog,
  initiallyExpanded,
}: {
  searchQuery: SearchQuery;
  setQuery: Dispatch<SearchQuery>;
  catalog: string;
  initiallyExpanded?: boolean;
}) {
  let serverState = useServerState();
  let [expanded, setExpanded] = useState(initiallyExpanded);

  let [currentQuery, setCurrentQuery] = useState(searchQuery);

  let updateQuery = useCallback(() => {
    setQuery(currentQuery);
  }, [setQuery, currentQuery]);

  let [trigger, cancel] = useTimeout(1000, updateQuery);

  let updateCurrentQuery = useCallback(
    (query: SearchQuery) => {
      setCurrentQuery(query);
      trigger();
    },
    [trigger],
  );

  let expand = useCallback(() => setExpanded(true), []);
  let collapse = useCallback(() => {
    setCurrentQuery(searchQuery);
    setExpanded(false);
    cancel();
  }, [searchQuery, cancel]);

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
        <SearchDescription query={searchQuery} serverState={serverState} />
        <IconButton icon="expand" onClick={expand} />
      </div>
    );
  }

  return (
    <div className="c-searchbar">
      <Icon icon="search" />
      <div className="expanded">
        <Compound
          query={currentQuery}
          setQuery={updateCurrentQuery}
          renderer={RenderCompoundQueryItem}
          serverState={serverState}
          catalog={catalog}
        />
      </div>
      <IconButton icon="collapse" onClick={collapse} />
    </div>
  );
}
