import { ChangeEvent, Dispatch, useCallback, useMemo } from "react";

import { IconButton } from "./Icon";
import {
  AlbumField,
  FieldQuery,
  PersonField,
  State,
  TagField,
} from "@/modules/types";

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
      className="c-query-value"
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
  let people = useMemo(() => {
    let forCatalog = serverState.people.filter((p) => p.catalog == catalog);
    forCatalog.sort((p1, p2) => p1.name.localeCompare(p2.name));
    return forCatalog;
  }, [catalog, serverState]);

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
    <select onChange={onChange} value={value}>
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
  let albums = useMemo(() => {
    let forCatalog = serverState.albums.filter((a) => a.catalog == catalog);
    forCatalog.sort((a1, a2) => a1.name.localeCompare(a2.name));
    return forCatalog;
  }, [catalog, serverState]);

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
    <select onChange={onChange} value={value}>
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
  let tags = useMemo(() => {
    let forCatalog = serverState.tags.filter((t) => t.catalog == catalog);
    forCatalog.sort((t1, t2) => t1.name.localeCompare(t2.name));
    return forCatalog;
  }, [catalog, serverState]);

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
    <select onChange={onChange} value={value}>
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
      <div className="parts">
        <span>{label}</span>
        <select onChange={onOperatorChange} value={currentOperator}>
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
