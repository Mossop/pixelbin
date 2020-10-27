import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import React, { useCallback, useMemo } from "react";

import type { Search } from "../../model";
import { Join } from "../../model";
import type { Catalog, Reference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { OverlayType } from "../overlays/types";
import { useActions } from "../store/actions";
import type { CatalogMediaLookup } from "../utils/medialookup";
import { MediaLookupType, useMediaLookup } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

export interface CatalogPageProps {
  readonly catalog: Reference<Catalog>;
}

export default function CatalogPage(props: CatalogPageProps & AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();

  let onAlbumCreate = useCallback(
    () => actions.showOverlay({
      type: OverlayType.AlbumCreate,
      parent: props.catalog,
    }),
    [props, actions],
  );

  let lookup = useMemo<CatalogMediaLookup>(() => ({
    type: MediaLookupType.Catalog,
    catalog: props.catalog,
  }), [props.catalog]);

  let onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.Media,
        media: media.id,
        lookup,
      },
    });
  }, [actions, lookup]);

  let media = useMediaLookup(lookup);

  let onCatalogEdit = useCallback(
    () => actions.showOverlay({
      type: OverlayType.CatalogEdit,
      catalog: props.catalog,
    }),
    [props, actions],
  );

  let onCatalogSearch = useCallback(() => {
    let query: Draft<Search.CompoundQuery> = {
      invert: false,
      type: "compound",
      join: Join.And,
      queries: [],
    };

    actions.showOverlay({
      type: OverlayType.Search,
      catalog: props.catalog,
      query,
    });
  }, [actions, props.catalog]);

  return <Page
    selectedItem={props.catalog.id}
    pageOptions={
      [{
        id: "catalog-search",
        onClick: onCatalogSearch,
        label: l10n.getString("banner-search"),
      }, {
        id: "album-create",
        onClick: onAlbumCreate,
        label: l10n.getString("banner-album-new"),
      }, {
        id: "catalog-edit",
        onClick: onCatalogEdit,
        label: l10n.getString("banner-catalog-edit"),
      }]
    }
  >
    <Content>
      <MediaGallery media={media} onClick={onMediaClick}/>
    </Content>
  </Page>;
}
