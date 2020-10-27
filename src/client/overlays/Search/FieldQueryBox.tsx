import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import FormControl from "@material-ui/core/FormControl";
import IconButton from "@material-ui/core/IconButton";
import Input from "@material-ui/core/Input";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import DeleteIcon from "@material-ui/icons/Delete";
import DragIndicatorIcon from "@material-ui/icons/DragIndicator";
import { DateTimePicker } from "@material-ui/pickers";
import clsx from "clsx";
import type { Draft } from "immer";
import React, { useState, useCallback, useMemo } from "react";

import type {
  RelationType,
  Search,
} from "../../../model";
import {
  allowedFields,
  allowedModifiers,
  allowedOperators,
  Modifier,
  Operator,
  valueType,
} from "../../../model";
import type { DateTime } from "../../../utils";
import { now } from "../../../utils";
import type { ReactResult } from "../../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    fieldQuery: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    queryField: {
      minWidth: "calc(24px + 17ch)",
      paddingRight: theme.spacing(2),
    },
    queryModifier: {
      minWidth: "calc(24px + 8ch)",
      paddingRight: theme.spacing(2),
    },
    queryOperator: {
      minWidth: "calc(24px + 23ch)",
      paddingRight: theme.spacing(2),
    },
    queryValue: {
      paddingRight: theme.spacing(2),
      flex: 1,
    },

    queryRow: {
    },
    grabHandle: {
      paddingRight: theme.spacing(0.5),
      width: 30 + theme.spacing(0.5),
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    },
    deleteButton: {
      marginTop: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
    },
    deleting: {
      backgroundColor: "rgb(255, 201, 201)",
    },
  }));

interface FieldQueryBoxProps {
  readonly inRelation: RelationType | null;
  readonly query: Search.FieldQuery;
  readonly onUpdateQuery: (oldQuery: Search.FieldQuery, newQuery: Search.FieldQuery) => void;
  readonly onDeleteQuery: (query: Search.FieldQuery) => void;
}

type SelectEvent = React.ChangeEvent<{ name?: string; value: unknown }>;

const ModifierOrder: (Modifier | null)[] = [
  null,
  Modifier.Length,
  Modifier.Year,
  Modifier.Month,
];

const OperatorOrder: Operator[] = [
  Operator.Empty,
  Operator.Equal,
  Operator.LessThan,
  Operator.LessThanOrEqual,
  Operator.Contains,
  Operator.StartsWith,
  Operator.EndsWith,
  Operator.Matches,
];

function intersect<T>(order: T[], allowed: T[]): T[] {
  let results: T[] = [];

  for (let item of order) {
    if (allowed.includes(item)) {
      results.push(item);
    }
  }

  return results;
}

export default function FieldQueryBox({
  inRelation,
  query,
  onUpdateQuery,
  onDeleteQuery,
}: FieldQueryBoxProps): ReactResult {
  let classes = useStyles();
  let { l10n } = useLocalization();
  let [deleting, setDeleting] = useState(false);

  let enterDelete = useCallback(() => {
    setDeleting(true);
  }, []);

  let leaveDelete = useCallback(() => {
    setDeleting(false);
  }, []);

  let deleteQuery = useCallback(() => {
    onDeleteQuery(query);
  }, [onDeleteQuery, query]);

  let onFieldChange = useCallback((event: SelectEvent) => {
    let newQuery: Draft<Search.FieldQuery> = {
      ...query,
      // @ts-ignore
      field: event.target.value,
    };

    let modifiers = allowedModifiers(newQuery, inRelation);
    if (!modifiers.includes(query.modifier)) {
      newQuery.modifier = intersect(ModifierOrder, modifiers)[0];
    }

    let operators = allowedOperators(newQuery, inRelation);
    if (!operators.includes(query.operator)) {
      newQuery.operator = intersect(OperatorOrder, operators)[0];
    }

    let newType = valueType(newQuery, inRelation);
    if (valueType(query, inRelation) != newType) {
      switch (newType) {
        case null:
          newQuery.value = null;
          break;
        case "string":
          newQuery.value = "";
          break;
        case "number":
          newQuery.value = 0;
          break;
        case "date":
          newQuery.value = now();
          break;
      }
    }

    onUpdateQuery(query, newQuery);
  }, [query, inRelation, onUpdateQuery]);

  let onModifierChange = useCallback((event: SelectEvent) => {
    let newQuery: Search.FieldQuery = {
      ...query,
      // @ts-ignore
      modifier: event.target.value == "null" ? null : event.target.value,
    };

    onUpdateQuery(query, newQuery);
  }, [query, onUpdateQuery]);

  let onOperatorChange = useCallback((event: SelectEvent) => {
    let operator = event.target.value as string;
    let invert = false;
    if (operator.startsWith("inverted-")) {
      operator = operator.substring(9);
      invert = true;
    }

    let newQuery: Search.FieldQuery = {
      ...query,
      invert,
      operator: operator as Operator,
    };

    onUpdateQuery(query, newQuery);
  }, [query, onUpdateQuery]);

  let onValueChange = useCallback((value: string | number | DateTime | null) => {
    let newQuery: Search.FieldQuery = {
      ...query,
      value,
    };

    onUpdateQuery(query, newQuery);
  }, [query, onUpdateQuery]);

  let onStringChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      onValueChange(event.target.value);
    },
    [onValueChange],
  );

  let onNumberChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      onValueChange(parseFloat(event.target.value));
    },
    [onValueChange],
  );

  let valueComponent: ReactResult = useMemo(() => {
    switch (valueType(query, inRelation)) {
      case "string": {
        return <Input type="text" value={query.value} onChange={onStringChange}/>;
      }
      case "number":
        return <Input type="number" value={query.value} onChange={onNumberChange}/>;
      case "date":
        return <DateTimePicker
          value={query.value}
          // @ts-ignore
          onChange={onValueChange}
        />;
      default:
        return null;
    }
  }, [query, inRelation, onValueChange, onStringChange, onNumberChange]);

  let operator = query.invert ? `inverted-${query.operator}` : query.operator;

  return <Box
    className={clsx(classes.fieldQuery, classes.queryRow, deleting && classes.deleting)}
  >
    <Box className={classes.grabHandle}>
      <DragIndicatorIcon/>
    </Box>
    <FormControl className={classes.queryField}>
      <Select fullWidth={true} value={query.field} onChange={onFieldChange}>
        {
          allowedFields(inRelation).map((field: string) => <MenuItem
            key={field}
            value={field}
          >
            {
              l10n.getString(`search-field-${field}`, {
                relation: inRelation ?? "",
              })
            }
          </MenuItem>)
        }
      </Select>
    </FormControl>
    <FormControl className={classes.queryModifier}>
      <Select value={query.modifier ?? "null"} onChange={onModifierChange}>
        {
          intersect(
            ModifierOrder,
            allowedModifiers(query, inRelation),
          ).map((modifier: Modifier | null) => <MenuItem
            key={modifier ?? "null"}
            value={modifier ?? "null"}
          >
            {l10n.getString(`search-modifier-${modifier ?? "null"}`)}
          </MenuItem>)
        }
      </Select>
    </FormControl>
    <FormControl className={classes.queryOperator}>
      <Select value={operator} onChange={onOperatorChange}>
        {
          intersect(
            OperatorOrder,
            allowedOperators(query, inRelation),
          ).map((operator: string) => <MenuItem
            key={operator}
            value={operator}
          >
            {l10n.getString(`search-operator-${operator}`)}
          </MenuItem>)
        }
      </Select>
    </FormControl>
    {
      valueComponent && <FormControl className={classes.queryValue}>
        {valueComponent}
      </FormControl>
    }
    <IconButton
      onMouseEnter={enterDelete}
      onMouseLeave={leaveDelete}
      onClick={deleteQuery}
      className={classes.deleteButton}
      size="small"
    >
      <DeleteIcon/>
    </IconButton>
  </Box>;
}
