import { useLocalization } from "@fluent/react";
import React, { useCallback, useMemo } from "react";

import { Catalog, Reference } from "../api/highlevel";
import { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import { CatalogMediaLookup, MediaLookupType, useMediaLookup } from "../utils/medialookup";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps, PageType } from "./types";

export interface CatalogPageProps {
  readonly catalog: Reference<Catalog>;
}

export default function CatalogPage(props: CatalogPageProps & AuthenticatedPageProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();

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

  let lookup = useMemo<CatalogMediaLookup>(() => ({
    type: MediaLookupType.Catalog,
    catalog: props.catalog,
  }), [props.catalog]);

  let media = useMediaLookup(lookup);

  return <Page
    selectedItem={props.catalog.id}
    pageOptions={
      [{
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
