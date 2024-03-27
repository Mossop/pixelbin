import { Dispatch, useCallback, useMemo } from "react";
import {
  SlInput,
  SlInputChangeEvent,
  SlOption,
  SlSelect,
  SlSelectChangeEvent,
} from "shoelace-react";

import {
  AlbumField,
  FieldQuery,
  MediaField,
  PersonField,
  State,
  TagField,
} from "@/modules/types";

import "styles/components/QueryFields.scss";

interface Option {
  id: string;
  name: string;
}

function optionList<T extends Option>(options: T[]): Option[] {
  let result = [...options];
  result.sort((o1, o2) => o1.name.localeCompare(o2.name));
  return result;
}

function hierarchicalList<T extends Option & { parent: string | null }>(
  options: T[],
): Option[] {
  let map = new Map(options.map((o) => [o.id, o]));
  let nameFor = (id: string): string => {
    let option = map.get(id)!;

    if (!option.parent) {
      return option.name;
    }

    return `${nameFor(option.parent)} > ${option.name}`;
  };

  let result = Array.from(map.keys(), (id) => ({ id, name: nameFor(id) }));
  result.sort((o1, o2) => o1.name.localeCompare(o2.name));
  return result;
}

function StringValue<F>({
  field,
  setField,
}: {
  field: FieldQuery<F>;
  setField: Dispatch<FieldQuery<F>>;
}) {
  let onChange = useCallback(
    (event: SlInputChangeEvent) => {
      setField({
        ...field,
        // @ts-ignore
        value: event.target.value,
      });
    },
    [field, setField],
  );

  if (field.operator == "empty") {
    return undefined;
  }

  return (
    <SlInput
      className="value"
      type="text"
      onSlChange={onChange}
      value={`${field.value}`}
    />
  );
}

export function RenderPeopleChoices({
  field,
  setField,
  catalog,
  serverState,
}: {
  field: FieldQuery<PersonField>;
  setField: Dispatch<FieldQuery<PersonField>>;
  catalog: string;
  serverState: State;
}) {
  let people = useMemo(
    () => optionList(serverState.people.filter((p) => p.catalog == catalog)),
    [catalog, serverState],
  );

  let onChange = useCallback(
    (event: SlSelectChangeEvent) => {
      setField({
        ...field,
        // @ts-ignore
        value: event.currentTarget.value,
      });
    },
    [field, setField],
  );

  // @ts-ignore
  let { value } = field;

  return (
    <SlSelect className="value" hoist onSlChange={onChange} value={value}>
      {people.map((p) => (
        <SlOption key={p.id} value={p.id}>
          {p.name}
        </SlOption>
      ))}
    </SlSelect>
  );
}

export function RenderAlbumChoices({
  field,
  setField,
  catalog,
  serverState,
}: {
  field: FieldQuery<AlbumField>;
  setField: Dispatch<FieldQuery<AlbumField>>;
  catalog: string;
  serverState: State;
}) {
  let albums = useMemo(
    () =>
      hierarchicalList(serverState.albums.filter((a) => a.catalog == catalog)),
    [catalog, serverState],
  );

  let onChange = useCallback(
    (event: SlSelectChangeEvent) => {
      setField({
        ...field,
        // @ts-ignore
        value: event.currentTarget.value,
      });
    },
    [field, setField],
  );

  // @ts-ignore
  let { value } = field;

  return (
    <SlSelect className="value" hoist onSlChange={onChange} value={value}>
      {albums.map((a) => (
        <SlOption key={a.id} value={a.id}>
          {a.name}
        </SlOption>
      ))}
    </SlSelect>
  );
}

export function RenderTagChoices({
  field,
  setField,
  catalog,
  serverState,
}: {
  field: FieldQuery<TagField>;
  setField: Dispatch<FieldQuery<TagField>>;
  catalog: string;
  serverState: State;
}) {
  let tags = useMemo(
    () =>
      hierarchicalList(serverState.tags.filter((t) => t.catalog == catalog)),
    [catalog, serverState],
  );

  let onChange = useCallback(
    (event: SlSelectChangeEvent) => {
      setField({
        ...field,
        // @ts-ignore
        value: event.currentTarget.value,
      });
    },
    [field, setField],
  );

  // @ts-ignore
  let { value } = field;

  return (
    <SlSelect className="value" hoist onSlChange={onChange} value={value}>
      {tags.map((t) => (
        <SlOption key={t.id} value={t.id}>
          {t.name}
        </SlOption>
      ))}
    </SlSelect>
  );
}

export function RelationQueryField<F>({
  label,
  id,
  name,
  field,
  setField,
  choices,
}: {
  label: string;
  id: F;
  name: F;
  field: FieldQuery<F>;
  setField: Dispatch<FieldQuery<F>>;
  choices: React.ReactNode;
}) {
  let onOperatorChange = useCallback(
    (event: SlSelectChangeEvent) => {
      let newField = { ...field };
      let value = event.target.value as string;

      if (value.startsWith("not-")) {
        newField.invert = true;
        // @ts-ignore
        newField.operator = value.substring(4);
      } else {
        if (newField.invert) {
          newField.invert = undefined;
        }
        // @ts-ignore
        newField.operator = value;
      }

      newField.field = newField.operator == "equal" ? id : name;
      if (newField.field !== field.field) {
        // @ts-ignore
        newField.value = "";
      }

      setField(newField);
    },
    [setField, field, id, name],
  );

  let currentOperator = useMemo(() => {
    if (field.field == id) {
      return `${field.invert ? "not-" : ""}equal`;
    }

    return `${field.invert ? "not-" : ""}${field.operator}`;
  }, [id, field]);

  return (
    <div className="c-query-field">
      <div className="label">{label}</div>
      <SlSelect
        className="operator"
        onSlChange={onOperatorChange}
        value={currentOperator}
        placement="bottom"
        hoist
      >
        <SlOption value="equal">is</SlOption>
        <SlOption value="not-equal">is not</SlOption>
        <SlOption value="startswith">starts with</SlOption>
        <SlOption value="not-startswith">doesn&apos;t start with</SlOption>
        <SlOption value="endswith">ends with</SlOption>
        <SlOption value="not-endswith">doesn&apos;t end with</SlOption>
        <SlOption value="contains">contains</SlOption>
        <SlOption value="not-contains">doesn&apos;t contain</SlOption>
        <SlOption value="matches">matches</SlOption>
        <SlOption value="not-matches">doesn&apos;t match</SlOption>
      </SlSelect>
      {field.field === id ? (
        choices
      ) : (
        <StringValue field={field} setField={setField} />
      )}
    </div>
  );
}

export function QueryField({
  field,
  setField,
}: {
  field: FieldQuery<MediaField>;
  setField: Dispatch<FieldQuery<MediaField>>;
}) {
  let onOperatorChange = useCallback(
    (event: SlSelectChangeEvent) => {
      let newField = { ...field };
      let value = event.target.value as string;

      if (value.startsWith("not-")) {
        newField.invert = true;
        // @ts-ignore
        newField.operator = value.substring(4);
      } else {
        if (newField.invert) {
          newField.invert = undefined;
        }
        // @ts-ignore
        newField.operator = value;
      }

      setField(newField);
    },
    [setField, field],
  );

  return (
    <div className="c-query-field">
      <div className="label">{field.field}</div>
      <SlSelect
        className="operator"
        onSlChange={onOperatorChange}
        value={field.operator}
        placement="bottom"
        hoist
      >
        <SlOption value="equal">is</SlOption>
        <SlOption value="not-equal">is not</SlOption>
        <SlOption value="startswith">starts with</SlOption>
        <SlOption value="not-startswith">doesn&apos;t start with</SlOption>
        <SlOption value="endswith">ends with</SlOption>
        <SlOption value="not-endswith">doesn&apos;t end with</SlOption>
        <SlOption value="contains">contains</SlOption>
        <SlOption value="not-contains">doesn&apos;t contain</SlOption>
        <SlOption value="matches">matches</SlOption>
        <SlOption value="not-matches">doesn&apos;t match</SlOption>
      </SlSelect>
      <StringValue field={field} setField={setField} />
    </div>
  );
}
