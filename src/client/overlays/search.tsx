import { Localized, useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Divider from "@material-ui/core/Divider";
import FormControl from "@material-ui/core/FormControl";
import IconButton from "@material-ui/core/IconButton";
import Link from "@material-ui/core/Link";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import DeleteIcon from "@material-ui/icons/Delete";
import DragIndicatorIcon from "@material-ui/icons/DragIndicator";
import FileCopy from "@material-ui/icons/FileCopy";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import PersonIcon from "@material-ui/icons/Person";
import PhotoAlbumIcon from "@material-ui/icons/PhotoAlbum";
import SpeedDial from "@material-ui/lab/SpeedDial";
import SpeedDialAction from "@material-ui/lab/SpeedDialAction";
import SpeedDialIcon from "@material-ui/lab/SpeedDialIcon";
import clsx from "clsx";
import React, { useCallback, useMemo, useState } from "react";

import {
  MediaFields,
  RelationFields,
  isCompoundQuery,
  Join,
  Query,
  Modifier,
  Operator,
  RelationType,
  Search,
  AllowedModifiers,
  isRelationQuery,
  ModifierResult,
  AllowedOperators,
} from "../../model";
import { Catalog, Reference } from "../api/highlevel";
import { MediaState } from "../api/types";
import { Preview } from "../components/Media";
import { PageType } from "../pages/types";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { MediaLookup, MediaLookupType, useMediaLookup } from "../utils/medialookup";
import { ReactResult } from "../utils/types";

const QueryKeys = new WeakMap<Search.Query, number>();
let nextKey = 1;
function queryKey(query: Query): number {
  let value = QueryKeys.get(query);
  if (!value) {
    QueryKeys.set(query, nextKey++);
    return nextKey;
  }
  return value;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    title: {
      paddingTop: theme.spacing(2),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
      paddingBottom: 0,
    },
    content: {
      paddingBottom: 0,
      display: "flex",
      flexDirection: "column",
      minWidth: "50vw",
    },
    actions: {
      padding: theme.spacing(1),
    },
    resultsDivider: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    previews: {
      overflowX: "auto",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "flex-start",
      padding: theme.spacing(1),
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
    buttonLink: {
      font: "inherit",
      color: theme.palette.background.default,
      backgroundColor: theme.palette.secondary.main,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      borderRadius: theme.shape.borderRadius,
      verticalAlign: "baseline",
      boxShadow: theme.shadows[2],
    },

    queryRow: {
    },
    deleting: {
      backgroundColor: "rgb(255, 201, 201)",
    },

    compound: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    },
    compoundTitleRow: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    compoundTitle: {
      flexGrow: 1,
    },
    compoundQueries: {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    },
    innerCompoundQueries: {
      paddingLeft: 30,
    },
    addRow: {
      alignSelf: "start",
      display: "flex",
      flexDirection: "row",
      justifyContent: "start",
    },
    addIcon: {
      width: 32,
      height: 32,
      minHeight: 32,
    },
    addActions: {
      paddingLeft: "40px !important",
    },

    fieldQuery: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    queryField: {
      minWidth: "calc(24px + 13ch)",
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

function FieldQueryBox({
  inRelation,
  query,
  onUpdateQuery,
  onDeleteQuery,
}: FieldQueryBoxProps): ReactResult {
  const classes = useStyles();
  const { l10n } = useLocalization();
  let validFields = (inRelation ? RelationFields : MediaFields) as Record<string, Search.FieldType>;
  let modifiers = AllowedModifiers[validFields[query.field]];
  const [deleting, setDeleting] = useState(false);

  const enterDelete = useCallback(() => {
    setDeleting(true);
  }, []);

  const leaveDelete = useCallback(() => {
    setDeleting(false);
  }, []);

  const deleteQuery = useCallback(() => {
    onDeleteQuery(query);
  }, [onDeleteQuery, query]);

  let fieldType = query.modifier
    ? ModifierResult[query.modifier]
    : validFields[query.field];
  let operators = AllowedOperators[fieldType];
  let valueType = operators[query.operator];
  let operatorList: string[] = [];
  for (let op of OperatorOrder) {
    if (op in operators) {
      operatorList.push(op);
      operatorList.push(`inverted-${op}`);
    }
  }

  let onFieldChange = useCallback((event: SelectEvent) => {
    let newQuery: Search.FieldQuery = {
      ...query,
      // @ts-ignore: We know this is a field name.
      field: event.target.value,
    };

    onUpdateQuery(query, newQuery);
  }, [query, onUpdateQuery]);

  let onModifierChange = useCallback((event: SelectEvent) => {
    let newQuery: Search.FieldQuery = {
      ...query,
      // @ts-ignore: We know this is a modifier.
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
          Object.keys(validFields).map((field: string) => <MenuItem
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
          ModifierOrder.map((modifier: Modifier | null) => {
            if (modifiers.includes(modifier)) {
              return <MenuItem
                key={modifier ?? "null"}
                value={modifier ?? "null"}
              >
                {l10n.getString(`search-modifier-${modifier ?? "null"}`)}
              </MenuItem>;
            }
            return null;
          })
        }
      </Select>
    </FormControl>
    <FormControl className={classes.queryOperator}>
      <Select value={operator} onChange={onOperatorChange}>
        {
          operatorList.map((operator: string) => <MenuItem
            key={operator}
            value={operator}
          >
            {l10n.getString(`search-operator-${operator}`)}
          </MenuItem>)
        }
      </Select>
    </FormControl>
    <FormControl className={classes.queryValue}>
      {
        valueType &&
          <TextField value={query.value}/>
      }
    </FormControl>
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

interface CompoundQueryBoxProps {
  readonly isInner?: boolean;
  readonly inRelation: RelationType | null;
  readonly query: Search.CompoundQuery;
  readonly onUpdateQuery: (oldQuery: Search.CompoundQuery, newQuery: Search.CompoundQuery) => void;
  readonly onDeleteQuery?: (query: Search.CompoundQuery) => void;
  catalog: Reference<Catalog>;
}

function CompoundQueryBox({
  isInner,
  inRelation,
  query,
  onUpdateQuery,
  onDeleteQuery,
  catalog: catalogRef,
}: CompoundQueryBoxProps): ReactResult {
  const classes = useStyles();
  const { l10n } = useLocalization();
  const [deleting, setDeleting] = useState(false);
  const catalog = useSelector(
    (state: StoreState): Catalog => catalogRef.deref(state.serverState),
  );

  const [dialOpen, setDialOpen] = useState(false);
  const onDialOpen = useCallback(() => setDialOpen(true), []);
  const onDialClose = useCallback(() => setDialOpen(false), []);

  const enterDelete = useCallback(() => {
    setDeleting(true);
  }, []);

  const leaveDelete = useCallback(() => {
    setDeleting(false);
  }, []);

  const deleteQuery = useMemo(() => {
    if (onDeleteQuery) {
      return () => onDeleteQuery(query);
    }
    return null;
  }, [query, onDeleteQuery]);

  const updateQuery = useCallback(
    (oldQuery: Search.Query, newQuery: Search.Query): void => {
      let updatedQuery: Search.CompoundQuery = {
        ...query,
        queries: query.queries.map((query: Search.Query): Search.Query => {
          if (query === oldQuery) {
            return newQuery;
          }
          return query;
        }),
      };

      onUpdateQuery(query, updatedQuery);
    },
    [onUpdateQuery, query],
  );

  const queryDeleted = useCallback((toDelete: Query): void => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      queries: query.queries.filter((query: Search.Query): boolean => {
        return query !== toDelete;
      }),
    };

    onUpdateQuery(query, updatedQuery);
  }, [onUpdateQuery, query]);

  const addField = useCallback(() => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      queries: [
        ...query.queries,
        {
          invert: false,
          type: "field",
          field: "title",
          modifier: null,
          operator: Operator.Equal,
          value: "",
        },
      ],
    };

    onUpdateQuery(query, updatedQuery);
  }, [query, onUpdateQuery]);

  const addCompound = useCallback(() => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      queries: [
        ...query.queries,
        {
          type: "compound",
          invert: false,
          join: Join.And,
          queries: [],
        },
      ],
    };

    onUpdateQuery(query, updatedQuery);
  }, [query, onUpdateQuery]);

  const addRelation = useCallback((relation: RelationType) => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      queries: [
        ...query.queries,
        {
          type: "compound",
          relation,
          recursive: true,
          invert: false,
          join: Join.And,
          queries: [],
        },
      ],
    };

    onUpdateQuery(query, updatedQuery);
  }, [query, onUpdateQuery]);

  const addAlbum = useMemo(() => addRelation.bind(null, RelationType.Album), [addRelation]);
  const addTag = useMemo(() => addRelation.bind(null, RelationType.Tag), [addRelation]);
  const addPerson = useMemo(() => addRelation.bind(null, RelationType.Person), [addRelation]);

  const toggleJoin = useCallback(() => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      invert: query.join == Join.And ? query.invert : !query.invert,
      join: query.join == Join.And ? Join.Or : Join.And,
    };

    onUpdateQuery(query, updatedQuery);
  }, [onUpdateQuery, query]);

  let currentRelation = inRelation;
  if (!currentRelation && isRelationQuery(query)) {
    currentRelation = query.relation;
  }

  let subheaderId = useMemo(() => {
    let join = query.join == Join.And ? "and" : "or";
    if (query.invert) {
      join = `not-${join}`;
    }
    let type = currentRelation ?? "compound";
    return isInner
      ? `search-dialog-${type}-${join}`
      : `search-dialog-${type}-initial-${join}`;
  }, [isInner, currentRelation, query.invert, query.join]);

  return <Box className={clsx(classes.queryRow, classes.compound, deleting && classes.deleting)}>
    <Box className={classes.compoundTitleRow}>
      {
        isInner &&
        <Box className={classes.grabHandle}>
          <DragIndicatorIcon/>
        </Box>
      }
      <Localized
        id={subheaderId}
        vars={
          {
            catalog: catalog.name,
          }
        }
        elems={
          {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Join: <Link
              className={classes.buttonLink}
              component="button"
              onClick={toggleJoin}
            />,
          }
        }
      >
        <Typography className={classes.compoundTitle} variant="subtitle1"/>
      </Localized>
      {
        deleteQuery &&
        <IconButton
          onMouseEnter={enterDelete}
          onMouseLeave={leaveDelete}
          onClick={deleteQuery}
          className={classes.deleteButton}
          size="small"
        >
          <DeleteIcon/>
        </IconButton>
      }
    </Box>
    <Box className={clsx(classes.compoundQueries, isInner && classes.innerCompoundQueries)}>
      {
        query.queries.map((innerQuery: Search.Query): ReactResult => {
          return <React.Fragment key={queryKey(innerQuery)}>
            {
              isCompoundQuery(innerQuery)
                ? <CompoundQueryBox
                  inRelation={currentRelation}
                  onUpdateQuery={updateQuery}
                  query={innerQuery}
                  isInner={true}
                  catalog={catalogRef}
                  onDeleteQuery={queryDeleted}
                />
                : <FieldQueryBox
                  inRelation={currentRelation}
                  onUpdateQuery={updateQuery}
                  query={innerQuery}
                  onDeleteQuery={queryDeleted}
                />
            }
          </React.Fragment>;
        })
      }
      <Box className={classes.addRow}>
        <SpeedDial
          ariaLabel={l10n.getString("search-dialog-add-button")}
          open={dialOpen}
          onOpen={onDialOpen}
          onClose={onDialClose}
          icon={<SpeedDialIcon/>}
          direction="right"
          transitionDuration={0}
          classes={
            {
              fab: classes.addIcon,
              actions: classes.addActions,
            }
          }
          FabProps={
            {
              size: "small",
            }
          }
        >
          <SpeedDialAction
            icon={<InsertDriveFileIcon/>}
            tooltipTitle={l10n.getString("search-dialog-add-field")}
            tooltipPlacement="bottom"
            onClick={addField}
            classes={
              {
                fab: classes.addIcon,
              }
            }
            FabProps={
              {
                size: "small",
              }
            }
          />
          <SpeedDialAction
            icon={<FileCopy/>}
            tooltipTitle={l10n.getString("search-dialog-add-compound")}
            tooltipPlacement="bottom"
            onClick={addCompound}
            classes={
              {
                fab: classes.addIcon,
              }
            }
            FabProps={
              {
                size: "small",
              }
            }
          />
          {
            !currentRelation && <SpeedDialAction
              icon={<PhotoAlbumIcon/>}
              tooltipTitle={l10n.getString("search-dialog-add-album")}
              tooltipPlacement="bottom"
              onClick={addAlbum}
              classes={
                {
                  fab: classes.addIcon,
                }
              }
              FabProps={
                {
                  size: "small",
                }
              }
            />
          }
          {
            !currentRelation && <SpeedDialAction
              icon={<LocalOfferIcon/>}
              tooltipTitle={l10n.getString("search-dialog-add-tag")}
              tooltipPlacement="bottom"
              onClick={addTag}
              classes={
                {
                  fab: classes.addIcon,
                }
              }
              FabProps={
                {
                  size: "small",
                }
              }
            />
          }
          {
            !currentRelation && <SpeedDialAction
              icon={<PersonIcon/>}
              tooltipTitle={l10n.getString("search-dialog-add-person")}
              tooltipPlacement="bottom"
              onClick={addPerson}
              classes={
                {
                  fab: classes.addIcon,
                }
              }
              FabProps={
                {
                  size: "small",
                }
              }
            />
          }
        </SpeedDial>
      </Box>
    </Box>
  </Box>;
}

export interface SearchOverlayProps {
  readonly catalog: Reference<Catalog>;
  readonly query: Query | null;
}

export default function SearchOverlayProps(props: SearchOverlayProps): ReactResult {
  const classes = useStyles();
  const { l10n } = useLocalization();
  const actions = useActions();
  const [open, setOpen] = useState(true);

  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);

  let baseQuery = useMemo<Search.CompoundQuery>(() => {
    if (props.query) {
      if (isCompoundQuery(props.query) && !isRelationQuery(props.query)) {
        return props.query;
      }

      return {
        invert: false,
        type: "compound",
        join: Join.And,
        queries: [props.query],
      };
    }

    return {
      invert: false,
      type: "compound",
      join: Join.And,
      queries: [],
    };
  }, [props.query]);

  const [query, setQuery] = useState<Search.CompoundQuery>(baseQuery);
  const lookup = useMemo<MediaLookup>(() => {
    return {
      type: MediaLookupType.Search,
      catalog: props.catalog,
      query,
    };
  }, [props.catalog, query]);

  const media = useMediaLookup(lookup);

  const onUpdateQuery = useCallback(
    (oldQuery: Search.CompoundQuery, newQuery: Search.CompoundQuery): void => {
      setQuery(newQuery);
    },
    [],
  );

  const reset = useCallback(() => {
    setQuery(baseQuery);
  }, [baseQuery]);

  const search = useCallback(() => {
    actions.navigate({
      page: {
        type: PageType.Search,
        catalog: props.catalog,
        query,
      },
    });
  }, [actions, props.catalog, query]);

  const close = useCallback(() => {
    setOpen(false);
    actions.closeOverlay();
  }, [actions]);

  return <Dialog
    open={open}
    scroll="body"
    onClose={close}
    maxWidth={false}
    aria-labelledby="search-dialog-title"
  >
    <DialogTitle id="search-dialog-title" className={classes.title}>
      {
        l10n.getString("search-dialog-title")
      }
    </DialogTitle>
    <DialogContent className={classes.content}>
      <CompoundQueryBox
        inRelation={null}
        onUpdateQuery={onUpdateQuery}
        query={query}
        catalog={props.catalog}
      />
      {
        media &&
        <React.Fragment>
          <Divider className={classes.resultsDivider}/>
          <Typography component="h3" variant="h6">
            {
              l10n.getString("search-dialog-results", {
                count: media.length,
              })
            }
          </Typography>
          <Box className={classes.previews}>
            {
              media.map((item: MediaState) => <Preview
                key={item.id}
                media={item}
                thumbnailSize={thumbnailSize}
              />)
            }
          </Box>
        </React.Fragment>
      }
    </DialogContent>
    <DialogActions disableSpacing={true} className={classes.actions}>
      <Button id="search-dialog-reset" onClick={reset}>
        {l10n.getString("search-dialog-reset")}
      </Button>
      <Button id="search-dialog-accept" onClick={search}>
        {l10n.getString("search-dialog-accept")}
      </Button>
    </DialogActions>
  </Dialog>;
}
