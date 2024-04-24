import {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  SlCard,
  SlRadioButton,
  SlRadioGroup,
  SlRadioGroupChangeEvent,
} from "shoelace-react";

import { IconButton } from "./Icon";
import { QueryField, RelationQueryField, ValueType } from "./QueryFields";
import { SearchDescription } from "@/components/SearchDescription";
import { useServerState, useTimeout } from "@/modules/hooks";
import {
  AlbumField,
  CompoundQuery,
  CompoundQueryItem,
  DispatchSSA,
  Join,
  PersonField,
  RelationQueryItem,
  SearchQuery,
  State,
  TagField,
} from "@/modules/types";
import { applySSA, keyFor } from "@/modules/util";

import "styles/components/SearchBar.scss";

type ItemRenderer<I> = (props: {
  item: I;
  setItem: DispatchSSA<I>;
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
  setQuery: DispatchSSA<T>;
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
  setCompound: DispatchSSA<T>;
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
    (ssa: SetStateAction<I>) => {
      setCompound((previous) => {
        let newItem = applySSA(previous.queries[item], ssa);
        return {
          ...compound,
          queries: [
            ...compound.queries.slice(0, item),
            newItem,
            ...compound.queries.slice(item + 1),
          ],
        };
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
  setQuery: DispatchSSA<T>;
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
  setItem: DispatchSSA<RelationQueryItem<TagField>>;
  serverState: State;
  catalog: string;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          // @ts-ignore
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
          // @ts-ignore
          setField={setItem}
          serverState={serverState}
          catalog={catalog}
          relationType={ValueType.Tag}
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
  setItem: DispatchSSA<RelationQueryItem<AlbumField>>;
  serverState: State;
  catalog: string;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          // @ts-ignore
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
          // @ts-ignore
          setField={setItem}
          serverState={serverState}
          catalog={catalog}
          relationType={ValueType.Album}
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
  setItem: DispatchSSA<RelationQueryItem<PersonField>>;
  serverState: State;
  catalog: string;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          // @ts-ignore
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
          // @ts-ignore
          setField={setItem}
          serverState={serverState}
          catalog={catalog}
          relationType={ValueType.Person}
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
  setItem: DispatchSSA<CompoundQueryItem>;
  serverState: State;
  catalog: string;
}) {
  // eslint-disable-next-line default-case
  switch (item.type) {
    case "compound":
      return (
        <Compound
          query={item}
          // @ts-ignore
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
          // @ts-ignore
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
          // @ts-ignore
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
          // @ts-ignore
          setQuery={setItem}
          renderer={RenderTagItem}
          serverState={serverState}
          catalog={catalog}
        />
      );
    default:
      return (
        <QueryField
          field={item}
          // @ts-ignore
          setField={setItem}
          serverState={serverState}
          catalog={catalog}
        />
      );
  }
}

export default function SearchBar({
  searchQuery,
  setQuery,
  catalog,
  initiallyExpanded,
}: {
  searchQuery: SearchQuery;
  setQuery: DispatchSSA<SearchQuery>;
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
    (ssa: SetStateAction<SearchQuery>) => {
      setCurrentQuery(ssa);
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
