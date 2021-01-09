import LuxonUtils from "@date-io/luxon";
import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Divider from "@material-ui/core/Divider";
import Fade from "@material-ui/core/Fade";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import { useState, useMemo, useEffect, useCallback } from "react";
import { shallowEqual } from "react-redux";

import type { Query, Search } from "../../../model";
import { isCompoundQuery, isRelationQuery, Join } from "../../../model";
import type { Catalog, Reference } from "../../api/highlevel";
import type { MediaState } from "../../api/types";
import DialogTitle from "../../components/Forms/DialogTitle";
import { IntersectionRoot } from "../../components/IntersectionObserver";
import Loading from "../../components/Loading";
import PreviewGrid from "../../components/Media/PreviewGrid";
import { PageType } from "../../pages/types";
import { useSelector, useServerState } from "../../store";
import { useActions } from "../../store/actions";
import type { StoreState } from "../../store/types";
import { useElementWidth } from "../../utils/hooks";
import type { MediaLookup } from "../../utils/medialookup";
import { MediaLookupType, lookupMedia } from "../../utils/medialookup";
import type { ReactResult } from "../../utils/types";
import CompoundQueryBox from "./CompoundQueryBox";

interface StyleProps {
  thumbnailSize: number;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    content: {
      minWidth: "50vw",
    },
    resultsDivider: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(1),
    },
    resultCount: {
      paddingLeft: theme.spacing(1),
      fontSize: "1.2rem",
    },
    results: {
      flex: 1,
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
    previewArea: ({ thumbnailSize }: StyleProps) => {
      let itemWidth = theme.spacing(4) + thumbnailSize;
      return {
        overflowY: "auto",
        maxHeight: itemWidth,
      };
    },
    previews: {
      padding: theme.spacing(1),
    },
  }));

export interface SearchDialogProps {
  readonly catalog: Reference<Catalog>;
  readonly query: Query | null;
}

interface SearchDialogState {
  thumbnailSize: number;
  pageType: PageType;
}

function searchDialogStateSelector(state: StoreState): SearchDialogState {
  return {
    thumbnailSize: state.settings.thumbnailSize,
    pageType: state.ui.page.type,
  };
}

export default function SearchDialog({ catalog, query }: SearchDialogProps): ReactResult {
  let serverState = useServerState();

  let {
    thumbnailSize,
    pageType,
  } = useSelector(searchDialogStateSelector, shallowEqual);
  let classes = useStyles({ thumbnailSize });
  let { l10n } = useLocalization();
  let actions = useActions();
  let [open, setOpen] = useState(true);
  let [searching, setSearching] = useState(true);
  let [media, setMedia] = useState<readonly MediaState[]>([]);
  let [resultsArea, setResultsArea] = useState<HTMLDivElement | null>(null);
  let width = useElementWidth(resultsArea);

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
    if (pageType == PageType.Search) {
      actions.replaceUIState({
        page: {
          type: PageType.Search,
          catalog: catalog,
          query: search,
        },
      });
    } else {
      actions.pushUIState({
        page: {
          type: PageType.Search,
          catalog: catalog,
          query: search,
        },
      });
    }
  }, [actions, catalog, search, pageType]);

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
      <DialogTitle id="search-dialog-title" title={l10n.getString("search-dialog-title")}/>
      <DialogContent className={classes.content}>
        <CompoundQueryBox
          inRelation={null}
          onUpdateQuery={onUpdateQuery}
          query={search}
          catalog={catalog}
        />
        <Divider className={classes.resultsDivider}/>
        <Box className={classes.results}>
          <h3 className={classes.resultCount}>
            {
              l10n.getString("search-dialog-results", {
                count: media.length,
              })
            }
          </h3>
          <div className={classes.previewArea} ref={setResultsArea}>
            <IntersectionRoot root={resultsArea} margin="250px 0px">
              <PreviewGrid media={media} className={classes.previews} width={width}/>
            </IntersectionRoot>
          </div>
          <Fade in={searching}>
            <Loading className={classes.resultsLoading}/>
          </Fade>
        </Box>
      </DialogContent>
      <DialogActions>
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
