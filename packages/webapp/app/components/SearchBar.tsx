import { Dispatch, useCallback, useEffect, useMemo, useState } from "react";
import {
  SlCard,
  SlRadioButton,
  SlRadioGroup,
  SlRadioGroupChangeEvent,
} from "shoelace-react";

import { IconButton } from "./Icon";
import {
  QueryField,
  RelationQueryField,
  RenderAlbumChoices,
  RenderPeopleChoices,
  RenderTagChoices,
} from "./QueryFields";
import { SearchDescription } from "@/components/SearchDescription";
import { keyFor, useServerState, useTimeout } from "@/modules/client-util";
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

import "styles/components/SearchBar.scss";

type ItemRenderer<I> = (props: {
  item: I;
  setItem: Dispatch<I>;
  deleteItem?: () => void;
  serverState: State;
  catalog: string;
}) => React.ReactNode;

enum CompoundType {
  And = "and",
  Nand = "nand",
  Or = "or",
  Nor = "nor",
}

function CompoundHeader<I, T extends Omit<CompoundQuery<I>, "type">>({
  query,
  setQuery,
}: {
  query: T;
  setQuery: (query: T) => void;
}) {
  let compoundType = useMemo(() => {
    if (query.join == Join.Or) {
      return query.invert ? CompoundType.Nor : CompoundType.Or;
    }
    return query.invert ? CompoundType.Nand : CompoundType.And;
  }, [query]);

  let setCompoundType = useCallback(
    (newType: CompoundType) => {
      let newQuery = { ...query };

      if (newType == CompoundType.Nand || newType == CompoundType.Nor) {
        newQuery.invert = true;
      } else if (newQuery.invert) {
        newQuery.invert = undefined;
      }

      if (newType == CompoundType.Nor || newType == CompoundType.Or) {
        newQuery.join = Join.Or;
      } else if (newQuery.join == Join.Or) {
        newQuery.join = undefined;
      }

      setQuery(newQuery);
    },
    [setQuery, query],
  );

  let joinChanged = useCallback(
    (event: SlRadioGroupChangeEvent) => {
      setCompoundType(event.target.value as CompoundType);
    },
    [setCompoundType],
  );

  return (
    <SlRadioGroup value={compoundType} onSlChange={joinChanged}>
      <SlRadioButton value={CompoundType.And}>All of</SlRadioButton>
      <SlRadioButton value={CompoundType.Or}>Any of</SlRadioButton>
      <SlRadioButton value={CompoundType.Nor}>None of</SlRadioButton>
      <SlRadioButton value={CompoundType.Nand}>Not all of</SlRadioButton>
    </SlRadioGroup>
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
      <IconButton icon="delete" onClick={deleteItem} />
    </li>
  );
}

function Compound<I extends object, T extends Omit<CompoundQuery<I>, "type">>({
  query,
  setQuery,
  serverState,
  catalog,
  renderer,
}: {
  query: T;
  setQuery: (query: T) => void;
  serverState: State;
  catalog: string;
  renderer: ItemRenderer<I>;
}) {
  return (
    <SlCard className="compound">
      <div className="header">
        <CompoundHeader query={query} setQuery={setQuery} />
      </div>
      <ul className="queries">
        {query.queries.map((item, index) => (
          <QueryItem
            key={keyFor(item)}
            compound={query}
            setCompound={setQuery}
            item={index}
            serverState={serverState}
            catalog={catalog}
            renderer={renderer}
          />
        ))}
      </ul>
    </SlCard>
  );
}

function RenderTagItem({
  item,
  setItem,
  serverState,
  catalog,
}: {
  item: RelationQueryItem<TagField>;
  setItem: Dispatch<RelationQueryItem<TagField>>;
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
  serverState,
  catalog,
}: {
  item: RelationQueryItem<AlbumField>;
  setItem: Dispatch<RelationQueryItem<AlbumField>>;
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
  serverState,
  catalog,
}: {
  item: RelationQueryItem<PersonField>;
  setItem: Dispatch<RelationQueryItem<PersonField>>;
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
  serverState,
  catalog,
}: {
  item: CompoundQueryItem;
  setItem: Dispatch<CompoundQueryItem>;
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
          serverState={serverState}
          catalog={catalog}
        />
      );
    default:
      return <QueryField field={item} setField={setItem} />;
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
        <SearchDescription query={searchQuery} serverState={serverState} />
        <IconButton icon="expand" onClick={expand} />
      </div>
    );
  }

  return (
    <div className="c-searchbar">
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
