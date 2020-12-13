import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import React, { useCallback, useMemo } from "react";

import type { Search } from "../../model";
import { Join } from "../../model";
import type { Catalog, Reference } from "../api/highlevel";
import { useReference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import AlbumAddIcon from "../icons/AlbumAddIcon";
import CatalogEditIcon from "../icons/CatalogEditIcon";
import SearchIcon from "../icons/SearchIcon";
import { useActions } from "../store/actions";
import type { CatalogMediaLookup } from "../utils/medialookup";
import { useMediaLookup, MediaLookupType } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

export interface CatalogPageProps {
  readonly catalog: Reference<Catalog>;
  readonly selectedMedia?: string;
}

export default function CatalogPage({
  catalog: catalogRef,
  selectedMedia,
}: CatalogPageProps & AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();
  let catalog = useReference(catalogRef);

  let onAlbumCreate = useCallback(
    () => actions.showDialog({
      type: DialogType.AlbumCreate,
      parent: catalogRef,
    }),
    [catalogRef, actions],
  );

  let lookup = useMemo<CatalogMediaLookup>(() => ({
    type: MediaLookupType.Catalog,
    catalog: catalogRef,
  }), [catalogRef]);

  let media = useMediaLookup(lookup);

  let onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.Catalog,
        catalog: catalogRef,
        selectedMedia: media.id,
      },
    });
  }, [actions, catalogRef]);

  let onCloseMedia = useCallback(() => {
    actions.navigate({
      page: {
        type: PageType.Catalog,
        catalog: catalogRef,
      },
    });
  }, [actions, catalogRef]);

  let onCatalogEdit = useCallback(
    () => actions.showDialog({
      type: DialogType.CatalogEdit,
      catalog: catalogRef,
    }),
    [catalogRef, actions],
  );

  let onCatalogSearch = useCallback(() => {
    let query: Draft<Search.CompoundQuery> = {
      invert: false,
      type: "compound",
      join: Join.And,
      queries: [],
    };

    actions.showDialog({
      type: DialogType.Search,
      catalog: catalogRef,
      query,
    });
  }, [actions, catalogRef]);

  return <MediaListPage
    galleryTitle={catalog.name}
    selectedItem={catalogRef.id}
    selectedMedia={selectedMedia}
    media={media}
    onMediaClick={onMediaClick}
    onCloseMedia={onCloseMedia}
    pageOptions={
      [{
        id: "catalog-search",
        onClick: onCatalogSearch,
        icon: <SearchIcon/>,
        label: l10n.getString("banner-search"),
      }, {
        id: "album-create",
        onClick: onAlbumCreate,
        icon: <AlbumAddIcon/>,
        label: l10n.getString("banner-album-new"),
      }, {
        id: "catalog-edit",
        onClick: onCatalogEdit,
        icon: <CatalogEditIcon/>,
        label: l10n.getString("banner-catalog-edit"),
      }]
    }
  />;
}
