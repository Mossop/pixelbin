import LuxonUtils from "@date-io/luxon";
import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Divider from "@material-ui/core/Divider";
import Fade from "@material-ui/core/Fade";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import React, { useState, useMemo, useEffect, useCallback } from "react";

import type { Query, Search } from "../../../model";
import { isCompoundQuery, isRelationQuery, Join } from "../../../model";
import type { Catalog, Reference } from "../../api/highlevel";
import type { MediaState, ServerState } from "../../api/types";
import Loading from "../../components/Loading";
import MediaPreview from "../../components/Media/MediaPreview";
import { PageType } from "../../pages/types";
import { useSelector } from "../../store";
import { useActions } from "../../store/actions";
import type { StoreState } from "../../store/types";
import type { MediaLookup } from "../../utils/medialookup";
import { MediaLookupType, lookupMedia } from "../../utils/medialookup";
import type { ReactResult } from "../../utils/types";
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
      marginBottom: theme.spacing(1),
    },
    resultCount: {
      paddingLeft: theme.spacing(1),
    },
    results: {
      display: "flex",
      flexDirection: "column",
      minHeight: 256,
      position: "relative",
      paddingTop: theme.spacing(1),
    },
    resultsLoading: {
      position: "absolute",
      top: 0,
      right: 0,
      left: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.5)",
      borderRadius: 8,
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

export interface SearchDialogProps {
  readonly catalog: Reference<Catalog>;
  readonly query: Query | null;
}

export default function SearchDialog({ catalog, query }: SearchDialogProps): ReactResult {
  let classes = useStyles();
  let { l10n } = useLocalization();
  let actions = useActions();
  let [open, setOpen] = useState(true);
  let [searching, setSearching] = useState(true);
  let [media, setMedia] = useState<readonly MediaState[]>([]);

  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);
  let serverState = useSelector((state: StoreState): ServerState => state.serverState);

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
    setSearching(true);
    let timeout = window.setTimeout(() => {
      void lookupMedia(serverState, lookup).then(
        (media: readonly MediaState[] | null | undefined) => {
          setSearching(false);
          setMedia(media ?? []);
        },
      );
    }, 500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [serverState, lookup]);

  useEffect(() => {
    document.title = l10n.getString("search-dialog-title");
  }, [l10n]);

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
    actions.closeDialog();
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
          <Typography className={classes.resultCount} component="h3" variant="h6">
            {
              l10n.getString("search-dialog-results", {
                count: media.length,
              })
            }
          </Typography>
          <Box className={classes.previews}>
            {
              media.map((item: MediaState) => <MediaPreview
                key={item.id}
                media={item}
                thumbnailSize={thumbnailSize}
              />)
            }
          </Box>
          <Fade in={searching}>
            <Loading className={classes.resultsLoading}/>
          </Fade>
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
