import { Fragment, SetStateAction, useCallback, useMemo } from "react";
import {
  SlDivider,
  SlInput,
  SlInputChangeEvent,
  SlOption,
  SlSelect,
  SlSelectChangeEvent,
} from "shoelace-react";

import {
  AlbumField,
  DispatchSSA,
  FieldQuery,
  MediaField,
  Modifier,
  PersonField,
  State,
  TagField,
} from "@/modules/types";
import { applySSA } from "@/modules/util";

import "styles/components/QueryFields.scss";

type SetField<F> = DispatchSSA<FieldQuery<F>>;

const MediaFields: Record<string, [MediaField, string | null][]> = {
  test: [
    [MediaField.Title, "Title"],
    [MediaField.Photographer, "Photographer"],
    [MediaField.Description, "Description"],
    [MediaField.Category, "Category"],
    [MediaField.Label, "Label"],
    [MediaField.Filename, "Filename"],
    [MediaField.Rating, "Rating"],
    [MediaField.Taken, "Taken"],
  ],
  kit: [
    [MediaField.Make, "Camera make"],
    [MediaField.Model, "Camera model"],
    [MediaField.Lens, "Lens"],
  ],
  settings: [
    [MediaField.Aperture, "Aperture"],
    [MediaField.ShutterSpeed, "Shutter speed"],
    [MediaField.Iso, "ISO"],
    [MediaField.FocalLength, "Focal length"],
  ],
  position: [
    [MediaField.Location, "Location"],
    [MediaField.City, "City"],
    [MediaField.State, "State"],
    [MediaField.Country, "Country"],
    [MediaField.Longitude, "Longitude"],
    [MediaField.Latitude, "Latitude"],
    [MediaField.Altitude, "Altitude"],
  ],
};

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
  setField: SetField<F>;
}) {
  let onChange = useCallback(
    (event: SlInputChangeEvent) => {
      setField((previous) => ({
        ...previous,
        value: event.target.value,
      }));
    },
    [setField],
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

function NumberValue<F>({
  field,
  setField,
}: {
  field: FieldQuery<F>;
  setField: SetField<F>;
}) {
  let onChange = useCallback(
    (event: SlInputChangeEvent) => {
      setField((previous) => {
        let newField: FieldQuery<F> = {
          ...previous,
          // @ts-expect-error
          value: event.target.valueAsNumber,
        };

        return newField;
      });
    },
    [setField],
  );

  if (field.operator == "empty") {
    return undefined;
  }

  return (
    <SlInput
      className="value"
      type="number"
      onSlChange={onChange}
      value={`${field.value}`}
    />
  );
}

function DateValue<F>({
  field,
  setField,
}: {
  field: FieldQuery<F>;
  setField: SetField<F>;
}) {
  let onChange = useCallback(
    (event: SlInputChangeEvent) => {
      setField((previous) => {
        let newField: FieldQuery<F> = {
          ...previous,
          // @ts-expect-error
          value: event.target.valueAsDate.toISOString(),
        };

        return newField;
      });
    },
    [setField],
  );

  let datePart = useMemo(() => {
    if (field.operator == "empty") {
      return "";
    }

    let fullDate = field.value.toString();
    let split = fullDate.indexOf("T");
    if (split > 0) {
      return fullDate.substring(0, split);
    }
    return fullDate;
  }, [field]);

  if (field.operator == "empty") {
    return undefined;
  }

  return (
    <SlInput
      className="value"
      type="date"
      onSlChange={onChange}
      value={datePart}
    />
  );
}

function PeopleValue({
  field,
  setField,
  catalog,
  serverState,
}: {
  field: FieldQuery<PersonField>;
  setField: SetField<PersonField>;
  catalog: string;
  serverState: State;
}) {
  let people = useMemo(
    () => optionList(serverState.people.filter((p) => p.catalog == catalog)),
    [catalog, serverState],
  );

  let onChange = useCallback(
    (event: SlSelectChangeEvent) => {
      setField((previous) => {
        let newField: FieldQuery<PersonField> = {
          ...previous,
          // @ts-expect-error
          value: event.currentTarget.value,
        };

        return newField;
      });
    },
    [setField],
  );

  // @ts-expect-error
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

function AlbumValue({
  field,
  setField,
  catalog,
  serverState,
}: {
  field: FieldQuery<AlbumField>;
  setField: SetField<AlbumField>;
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
      setField((previous) => {
        let newField: FieldQuery<AlbumField> = {
          ...previous,
          // @ts-expect-error
          value: event.currentTarget.value,
        };

        return newField;
      });
    },
    [setField],
  );

  // @ts-expect-error
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

function TagValue({
  field,
  setField,
  catalog,
  serverState,
}: {
  field: FieldQuery<TagField>;
  setField: SetField<TagField>;
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
      setField((previous) => {
        let newField: FieldQuery<TagField> = {
          ...previous,
          // @ts-expect-error
          value: event.currentTarget.value,
        };

        return newField;
      });
    },
    [setField],
  );

  // @ts-expect-error
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

export enum ValueType {
  String,
  Number,
  Date,
  Person,
  Album,
  Tag,
}

export function FieldValue<F>({
  type,
  field,
  setField,
  catalog,
  serverState,
}: {
  type: ValueType;
  field: FieldQuery<F>;
  setField: SetField<F>;
  catalog: string;
  serverState: State;
}) {
  switch (type) {
    case ValueType.Person:
      return (
        <PeopleValue
          // @ts-expect-error
          field={field}
          // @ts-expect-error
          setField={setField}
          catalog={catalog}
          serverState={serverState}
        />
      );
    case ValueType.Tag:
      return (
        <TagValue
          // @ts-expect-error
          field={field}
          // @ts-expect-error
          setField={setField}
          catalog={catalog}
          serverState={serverState}
        />
      );
    case ValueType.Album:
      return (
        <AlbumValue
          // @ts-expect-error
          field={field}
          // @ts-expect-error
          setField={setField}
          catalog={catalog}
          serverState={serverState}
        />
      );
    case ValueType.Number:
      return <NumberValue field={field} setField={setField} />;
    case ValueType.Date:
      return <DateValue field={field} setField={setField} />;
    default:
      return <StringValue field={field} setField={setField} />;
  }
}

function NumberOperator({
  field,
  setField,
}: {
  field: FieldQuery<MediaField>;
  setField: SetField<MediaField>;
}) {
  let onOperatorChange = useCallback(
    (event: SlSelectChangeEvent) => {
      setField((previous) => {
        let newField = { ...previous };
        let value = event.target.value as string;

        if (value.startsWith("not-")) {
          newField.invert = true;
          // @ts-expect-error
          newField.operator = value.substring(4);
        } else {
          if (newField.invert) {
            newField.invert = undefined;
          }
          // @ts-expect-error
          newField.operator = value;
        }

        return newField;
      });
    },
    [setField],
  );

  let currentOperator = useMemo(
    () => `${field.invert ? "not-" : ""}${field.operator}`,
    [field],
  );

  return (
    <SlSelect
      className="operator"
      onSlChange={onOperatorChange}
      value={currentOperator}
      placement="bottom"
      hoist
    >
      <SlOption value="equal">==</SlOption>
      <SlOption value="not-equal">!=</SlOption>
      <SlOption value="lessthan">{"<"}</SlOption>
      <SlOption value="lessthanequal">{"<="}</SlOption>
      <SlOption value="not-lessthanequal">{">"}</SlOption>
      <SlOption value="not-lessthan">{">="}</SlOption>
    </SlSelect>
  );
}

function StringOperator({
  field,
  setField,
}: {
  field: FieldQuery<MediaField>;
  setField: SetField<MediaField>;
}) {
  let onOperatorChange = useCallback(
    (event: SlSelectChangeEvent) => {
      setField((previous) => {
        let newField = { ...previous };
        let value = event.target.value as string;

        if (value.startsWith("not-")) {
          newField.invert = true;
          // @ts-expect-error
          newField.operator = value.substring(4);
        } else {
          if (newField.invert) {
            newField.invert = undefined;
          }
          // @ts-expect-error
          newField.operator = value;
        }

        return newField;
      });
    },
    [setField],
  );

  let currentOperator = useMemo(
    () => `${field.invert ? "not-" : ""}${field.operator}`,
    [field],
  );

  return (
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
  );
}

function FieldOperator({
  operatorType,
  field,
  setField,
}: {
  operatorType: ValueType;
  field: FieldQuery<MediaField>;
  setField: SetField<MediaField>;
}) {
  switch (operatorType) {
    case ValueType.Number:
    case ValueType.Date:
      return <NumberOperator field={field} setField={setField} />;
    default:
      return <StringOperator field={field} setField={setField} />;
  }
}

export function RelationQueryField<F>({
  label,
  id,
  name,
  field,
  setField,
  relationType,
  catalog,
  serverState,
}: {
  label: string;
  id: F;
  name: F;
  field: FieldQuery<F>;
  setField: SetField<F>;
  relationType: ValueType;
  catalog: string;
  serverState: State;
}) {
  let onOperatorChange = useCallback(
    (event: SlSelectChangeEvent) => {
      setField((previous) => {
        let newField = { ...previous };
        let value = event.target.value as string;

        if (value.startsWith("not-")) {
          newField.invert = true;
          // @ts-expect-error
          newField.operator = value.substring(4);
        } else {
          if (newField.invert) {
            newField.invert = undefined;
          }
          // @ts-expect-error
          newField.operator = value;
        }

        newField.field = newField.operator == "equal" ? id : name;
        if (newField.field !== previous.field) {
          // @ts-expect-error
          newField.value = "";
        }

        return newField;
      });
    },
    [setField, id, name],
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
      <FieldValue
        field={field}
        setField={setField}
        catalog={catalog}
        serverState={serverState}
        type={field.field === id ? relationType : ValueType.String}
      />
    </div>
  );
}

function fieldType(field: MediaField): ValueType {
  switch (field) {
    case MediaField.ShutterSpeed:
    case MediaField.Longitude:
    case MediaField.Latitude:
    case MediaField.Altitude:
    case MediaField.Aperture:
    case MediaField.Iso:
    case MediaField.FocalLength:
    case MediaField.Rating:
      return ValueType.Number;
    case MediaField.Taken:
      return ValueType.Date;
    default:
      return ValueType.String;
  }
}

function modifiedType(sourceType: ValueType, modifier?: Modifier): ValueType {
  switch (sourceType) {
    case ValueType.String:
      if (modifier == Modifier.Length) {
        return ValueType.Number;
      }
      return sourceType;
    case ValueType.Date:
      switch (modifier) {
        case Modifier.DayOfWeek:
        case Modifier.Day:
        case Modifier.Month:
        case Modifier.Year:
          return ValueType.Number;
        default:
          return sourceType;
      }
    default:
      return sourceType;
  }
}

function modifiersForType(sourceType: ValueType): Modifier[] {
  switch (sourceType) {
    case ValueType.String:
      return [Modifier.Length];
    case ValueType.Date:
      return [Modifier.DayOfWeek, Modifier.Day, Modifier.Month, Modifier.Year];
    default:
      return [];
  }
}

export function QueryField({
  field,
  setField,
  catalog,
  serverState,
}: {
  field: FieldQuery<MediaField>;
  setField: SetField<MediaField>;
  catalog: string;
  serverState: State;
}) {
  let valueType = fieldType(field.field);
  let modifiers = modifiersForType(valueType);
  valueType = modifiedType(valueType, field.modifier);

  let updateField = useCallback(
    (ssa: SetStateAction<FieldQuery<MediaField>>) => {
      setField((previous) => {
        let previousType = modifiedType(
          fieldType(previous.field),
          previous.modifier,
        );

        let next = applySSA(previous, ssa);

        let type = fieldType(next.field);
        if (next.modifier && !modifiersForType(type).includes(next.modifier)) {
          next.modifier = undefined;
        }

        type = modifiedType(type, next.modifier);

        if (previousType !== type) {
          next.invert = undefined;
          next.operator = "equal";

          switch (type) {
            case ValueType.Number:
              // @ts-expect-error
              next.value = 0;
              break;
            default:
              // @ts-expect-error
              next.value = "";
          }
        }

        return next;
      });
    },
    [setField],
  );

  let onLabelChange = useCallback(
    (event: SlSelectChangeEvent) => {
      let newField = { ...field, field: event.target.value as MediaField };
      updateField(newField);
    },
    [updateField, field],
  );

  let onModifierChange = useCallback(
    (event: SlSelectChangeEvent) => {
      let modifier: Modifier | undefined;
      if (event.target.value) {
        modifier = event.target.value as Modifier;
      }

      let newField = {
        ...field,
        modifier,
      };
      updateField(newField);
    },
    [updateField, field],
  );

  return (
    <div className="c-query-field">
      <SlSelect
        className="label"
        onSlChange={onLabelChange}
        value={field.field}
        placement="bottom"
        hoist
      >
        {Object.entries(MediaFields).map(([section, fields], index) => (
          <Fragment key={section}>
            {index !== 0 && <SlDivider />}
            {fields.map(([fld, label]) => (
              <SlOption key={fld} value={fld}>
                {label}
              </SlOption>
            ))}
          </Fragment>
        ))}
      </SlSelect>
      {modifiers.length > 0 && (
        <SlSelect
          className="modifier"
          onSlChange={onModifierChange}
          value={field.modifier}
          placement="bottom"
          clearable
          hoist
        >
          {modifiers.map((modifier) => (
            <SlOption key={modifier} value={modifier}>
              {modifier}
            </SlOption>
          ))}
        </SlSelect>
      )}
      <FieldOperator
        field={field}
        setField={updateField}
        operatorType={valueType}
      />
      <FieldValue
        type={valueType}
        field={field}
        setField={updateField}
        catalog={catalog}
        serverState={serverState}
      />
    </div>
  );
}
