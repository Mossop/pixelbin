import { ChangeEvent, Dispatch, useCallback, useMemo } from "react";

import { IconButton } from "./Icon";
import {
  AlbumField,
  FieldQuery,
  PersonField,
  State,
  TagField,
} from "@/modules/types";

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
    (event: ChangeEvent<HTMLInputElement>) => {
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
    <input
      className="value"
      type="text"
      onChange={onChange}
      value={field.value}
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
    (event: ChangeEvent<HTMLSelectElement>) => {
      let option = event.target.options[event.target.selectedIndex];
      setField({
        ...field,
        // @ts-ignore
        value: option.value,
      });
    },
    [field, setField],
  );

  // @ts-ignore
  let { value } = field;

  return (
    <select className="value" onChange={onChange} value={value}>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
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
    (event: ChangeEvent<HTMLSelectElement>) => {
      let option = event.target.options[event.target.selectedIndex];
      setField({
        ...field,
        // @ts-ignore
        value: option.value,
      });
    },
    [field, setField],
  );

  // @ts-ignore
  let { value } = field;

  return (
    <select className="value" onChange={onChange} value={value}>
      {albums.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
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
    (event: ChangeEvent<HTMLSelectElement>) => {
      let option = event.target.options[event.target.selectedIndex];
      setField({
        ...field,
        // @ts-ignore
        value: option.value,
      });
    },
    [field, setField],
  );

  // @ts-ignore
  let { value } = field;

  return (
    <select className="value" onChange={onChange} value={value}>
      {tags.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export function RelationQueryField<F>({
  label,
  id,
  name,
  field,
  setField,
  deleteField,
  choices,
}: {
  label: string;
  id: F;
  name: F;
  field: FieldQuery<F>;
  setField: Dispatch<FieldQuery<F>>;
  deleteField?: () => void;
  choices: React.ReactNode;
}) {
  let onOperatorChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      let newField = { ...field };
      let option = event.target.options[event.target.selectedIndex];

      newField.invert = false;
      if (option.value.startsWith("not-")) {
        newField.invert = true;
        // @ts-ignore
        newField.operator = option.value.substring(4);
      } else {
        // @ts-ignore
        newField.operator = option.value;
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
    <>
      <div className="c-query-field">
        <div className="label">
          <span>{label}</span>
        </div>
        <select
          className="operator"
          onChange={onOperatorChange}
          value={currentOperator}
        >
          <option value="equal">is</option>
          <option value="not-equal">is not</option>
          <option value="startswith">starts with</option>
          <option value="not-startswith">doesn&apos;t start with</option>
          <option value="endswith">ends with</option>
          <option value="not-endswith">doesn&apos;t end with</option>
          <option value="contains">contains</option>
          <option value="not-contains">doesn&apos;t contain</option>
          <option value="matches">matches</option>
          <option value="not-matches">doesn&apos;t match</option>
        </select>
        {field.field === id ? (
          choices
        ) : (
          <StringValue field={field} setField={setField} />
        )}
      </div>
      {deleteField && <IconButton icon="delete" onClick={deleteField} />}
    </>
  );
}
