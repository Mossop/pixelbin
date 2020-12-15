import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import React, { useCallback, useMemo } from "react";

import type { Query } from "../../model";
import type { Catalog, Reference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import SearchEditIcon from "../icons/SearchEditIcon";
import SearchSaveIcon from "../icons/SearchSaveIcon";
import { useActions } from "../store/actions";
import type { SearchMediaLookup } from "../utils/medialookup";
import { useMediaLookup, MediaLookupType } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

export interface SearchPageProps {
  catalog: Reference<Catalog>;
  query: Query;
  selectedMedia?: string;
}

export default function SearchPage({
  query,
  catalog,
  selectedMedia,
}: SearchPageProps & AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();

  let lookup = useMemo<SearchMediaLookup>(() => ({
    type: MediaLookupType.Search,
    catalog,
    query,
  }), [catalog, query]);

  let media = useMediaLookup(lookup);

  let onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.Search,
        query,
        catalog,
        selectedMedia: media.id,
      },
    });
  }, [actions, query, catalog]);

  let onCloseMedia = useCallback((): void => {
    actions.navigate({
      page: {
        type: PageType.Search,
        query,
        catalog,
      },
    });
  }, [actions, query, catalog]);

  let onEditSearch = useCallback(() => {
    // @ts-ignore
    let newQuery: Draft<Query> = {
      ...query,
    };

    actions.showDialog({
      type: DialogType.Search,
      catalog,
      query: newQuery,
    });
  }, [actions, catalog, query]);

  let onSaveSearch = useCallback(() => {
    // @ts-ignore
    let newQuery: Draft<Query> = {
      ...query,
    };

    actions.showDialog({
      type: DialogType.SavedSearchCreate,
      catalog,
      query: newQuery,
    });
  }, [actions, catalog, query]);

  let pageOptions = useMemo(() => [{
    id: "edit-search",
    onClick: onEditSearch,
    icon: <SearchEditIcon/>,
    label: l10n.getString("banner-edit-search"),
  }, {
    id: "save-search",
    onClick: onSaveSearch,
    icon: <SearchSaveIcon/>,
    label: l10n.getString("banner-save-search"),
  }], [l10n, onEditSearch, onSaveSearch]);

  return <MediaListPage
    media={media}
    galleryTitle={l10n.getString("search-page-title")}
    selectedMedia={selectedMedia}
    onMediaClick={onMediaClick}
    onCloseMedia={onCloseMedia}
    pageOptions={pageOptions}
  />;
}
