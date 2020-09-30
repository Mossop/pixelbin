import { useLocalization } from "@fluent/react";
import React, { useCallback, useEffect } from "react";

import { Catalog, Reference } from "../api/highlevel";
import { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { MediaLookupType, StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps, PageType } from "./types";

export interface CatalogPageProps {
  readonly catalog: Reference<Catalog>;
}

export default function CatalogPage(props: CatalogPageProps & AuthenticatedPageProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();
  const media = useSelector((state: StoreState) => state.mediaList?.media);

  const onCatalogEdit = useCallback(
    () => actions.showCatalogEditOverlay(props.catalog),
    [actions, props],
  );

  const onAlbumCreate = useCallback(
    () => actions.showAlbumCreateOverlay(props.catalog),
    [props, actions],
  );

  const onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.Media,
        media: media.id,
        lookup: {
          type: MediaLookupType.Catalog,
          catalog: props.catalog,
        },
      },
    });
  }, [actions, props.catalog]);

  useEffect(
    () => actions.listMedia({
      type: MediaLookupType.Catalog,
      catalog: props.catalog,
    }),
    [props.catalog, actions],
  );

  return <Page
    selectedItem={props.catalog.id}
    pageOptions={
      [{
        id: "catalog-edit",
        onClick: onCatalogEdit,
        label: l10n.getString("banner-catalog-edit"),
      }, {
        id: "album-create",
        onClick: onAlbumCreate,
        label: l10n.getString("banner-album-new"),
      }]
    }
  >
    <Content>
      <MediaGallery media={media} onClick={onMediaClick}/>
    </Content>
  </Page>;
}
