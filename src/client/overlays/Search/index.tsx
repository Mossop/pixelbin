import LuxonUtils from "@date-io/luxon";
import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Divider from "@material-ui/core/Divider";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import React, { useState, useMemo, useEffect, useCallback } from "react";

import { isCompoundQuery, isRelationQuery, Join, Query, Search } from "../../../model";
import { Catalog, Reference } from "../../api/highlevel";
import { MediaState } from "../../api/types";
import Loading from "../../components/Loading";
import { Preview } from "../../components/Media";
import { PageType } from "../../pages/types";
import { useSelector } from "../../store";
import { useActions } from "../../store/actions";
import { StoreState } from "../../store/types";
import { MediaLookup, MediaLookupType, lookupMedia } from "../../utils/medialookup";
import { ReactResult } from "../../utils/types";
import CompoundQueryBox from "./CompoundQueryBox";

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
    results: {
      display: "flex",
      flexDirection: "column",
      minHeight: 256,
    },
    resultsLoading: {
      flex: 1,
    },
    previews: {
      overflowX: "auto",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "flex-start",
      padding: theme.spacing(1),
    },
  }));

export interface SearchOverlayProps {
  readonly catalog: Reference<Catalog>;
  readonly query: Query | null;
}

export default function SearchOverlay({ catalog, query }: SearchOverlayProps): ReactResult {
  let classes = useStyles();
  let { l10n } = useLocalization();
  let actions = useActions();
  let [open, setOpen] = useState(true);
  let [media, setMedia] = useState<readonly MediaState[] | null>(null);

  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);

  let baseQuery = useMemo<Search.CompoundQuery>(() => {
    if (query) {
      if (isCompoundQuery(query) && !isRelationQuery(query)) {
        return query;
      }

      return {
        invert: false,
        type: "compound",
        join: Join.And,
        queries: [query],
      };
    }

    return {
      invert: false,
      type: "compound",
      join: Join.And,
      queries: [],
    };
  }, [query]);

  let [search, setSearch] = useState<Search.CompoundQuery>(baseQuery);
  let lookup = useMemo<MediaLookup>(() => {
    return {
      type: MediaLookupType.Search,
      catalog: catalog,
      query: search,
    };
  }, [catalog, search]);

  useEffect(() => {
    let timeout = window.setTimeout(() => {
      void lookupMedia(lookup).then(setMedia);
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [lookup]);

  let onUpdateQuery = useCallback(
    (oldQuery: Search.CompoundQuery, newQuery: Search.CompoundQuery): void => {
      setSearch(newQuery);
    },
    [],
  );

  let onReset = useCallback(() => {
    setSearch(baseQuery);
  }, [baseQuery]);

  let onSearch = useCallback(() => {
    actions.navigate({
      page: {
        type: PageType.Search,
        catalog: catalog,
        query: search,
      },
    });
  }, [actions, catalog, search]);

  let close = useCallback(() => {
    setOpen(false);
    actions.closeOverlay();
  }, [actions]);

  return <MuiPickersUtilsProvider utils={LuxonUtils}>
    <Dialog
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
          query={search}
          catalog={catalog}
        />
        <Divider className={classes.resultsDivider}/>
        <Box className={classes.results}>
          {
            media === null
              ? <Loading className={classes.resultsLoading}/>
              : <React.Fragment>
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
        </Box>
      </DialogContent>
      <DialogActions disableSpacing={true} className={classes.actions}>
        <Button id="search-dialog-reset" onClick={onReset}>
          {l10n.getString("search-dialog-reset")}
        </Button>
        <Button id="search-dialog-accept" onClick={onSearch}>
          {l10n.getString("search-dialog-accept")}
        </Button>
      </DialogActions>
    </Dialog>
  </MuiPickersUtilsProvider>;
}
