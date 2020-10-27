import { Localized, useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Link from "@material-ui/core/Link";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
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
import React, { useState, useCallback, useMemo } from "react";

import type {
  Query,
  Search,
} from "../../../model";
import {
  allowedFields,
  isCompoundQuery,
  isRelationQuery,
  Join,
  Operator,
  RelationType,
} from "../../../model";
import type { Catalog, Reference } from "../../api/highlevel";
import { useSelector } from "../../store";
import type { StoreState } from "../../store/types";
import type { ReactResult } from "../../utils/types";
import FieldQueryBox from "./FieldQueryBox";

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

function updateQueryKey(oldQuery: Query, newQuery: Query): void {
  let value = QueryKeys.get(oldQuery);
  if (value) {
    QueryKeys.delete(oldQuery);
    QueryKeys.set(newQuery, value);
  }
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
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
    queryRow: {
    },
    deleting: {
      backgroundColor: "rgb(255, 201, 201)",
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
  }));

interface CompoundQueryBoxProps {
  readonly isInner?: boolean;
  readonly inRelation: RelationType | null;
  readonly query: Search.CompoundQuery;
  readonly onUpdateQuery: (oldQuery: Search.CompoundQuery, newQuery: Search.CompoundQuery) => void;
  readonly onDeleteQuery?: (query: Search.CompoundQuery) => void;
  catalog: Reference<Catalog>;
}

export default function CompoundQueryBox({
  isInner,
  inRelation,
  query,
  onUpdateQuery,
  onDeleteQuery,
  catalog: catalogRef,
}: CompoundQueryBoxProps): ReactResult {
  let classes = useStyles();
  let { l10n } = useLocalization();
  let [deleting, setDeleting] = useState(false);
  let catalog = useSelector(
    (state: StoreState): Catalog => catalogRef.deref(state.serverState),
  );

  let [dialOpen, setDialOpen] = useState(false);
  let onDialOpen = useCallback(() => setDialOpen(true), []);
  let onDialClose = useCallback(() => setDialOpen(false), []);

  let enterDelete = useCallback(() => {
    setDeleting(true);
  }, []);

  let leaveDelete = useCallback(() => {
    setDeleting(false);
  }, []);

  let deleteQuery = useMemo(() => {
    if (onDeleteQuery) {
      return () => onDeleteQuery(query);
    }
    return null;
  }, [query, onDeleteQuery]);

  let updateQuery = useCallback(
    (oldQuery: Search.Query, newQuery: Search.Query): void => {
      updateQueryKey(oldQuery, newQuery);

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

  let queryDeleted = useCallback((toDelete: Query): void => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      queries: query.queries.filter((query: Search.Query): boolean => {
        return query !== toDelete;
      }),
    };

    onUpdateQuery(query, updatedQuery);
  }, [onUpdateQuery, query]);

  let currentRelation = inRelation;
  if (!currentRelation && isRelationQuery(query)) {
    currentRelation = query.relation;
  }

  let addField = useCallback(() => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      queries: [
        ...query.queries,
        {
          invert: false,
          type: "field",
          field: allowedFields(currentRelation)[0],
          modifier: null,
          operator: Operator.Equal,
          value: "",
        },
      ],
    };

    onUpdateQuery(query, updatedQuery);
  }, [query, onUpdateQuery, currentRelation]);

  let addCompound = useCallback(() => {
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

  let addRelation = useCallback((relation: RelationType) => {
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

  let addAlbum = useMemo(() => addRelation.bind(null, RelationType.Album), [addRelation]);
  let addTag = useMemo(() => addRelation.bind(null, RelationType.Tag), [addRelation]);
  let addPerson = useMemo(() => addRelation.bind(null, RelationType.Person), [addRelation]);

  let toggleJoin = useCallback(() => {
    let updatedQuery: Search.CompoundQuery = {
      ...query,
      invert: query.join == Join.And ? query.invert : !query.invert,
      join: query.join == Join.And ? Join.Or : Join.And,
    };

    onUpdateQuery(query, updatedQuery);
  }, [onUpdateQuery, query]);

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
