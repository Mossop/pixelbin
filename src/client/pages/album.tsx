import { useLocalization } from "@fluent/react";
import { Draft } from "immer";
import React, { useCallback, useMemo } from "react";

import { Join, Operator, RelationType, Search } from "../../model";
import { Album, Reference } from "../api/highlevel";
import { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { AlbumMediaLookup, MediaLookupType, useMediaLookup } from "../utils/medialookup";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps, PageType } from "./types";

export interface AlbumPageProps {
  readonly album: Reference<Album>;
}

export default function AlbumPage(props: AlbumPageProps & AuthenticatedPageProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();
  let album = useSelector((state: StoreState) => props.album.deref(state.serverState));

  const onAlbumEdit = useCallback(
    () => actions.showAlbumEditOverlay(props.album),
    [actions, props.album],
  );

  const onAlbumCreate = useCallback(
    () => actions.showAlbumCreateOverlay(props.album),
    [props.album, actions],
  );

  const onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.Media,
        media: media.id,
        lookup: {
          type: MediaLookupType.Album,
          album: props.album,
          recursive: true,
        },
      },
    });
  }, [actions, props.album]);

  let lookup = useMemo<AlbumMediaLookup>(() => ({
    type: MediaLookupType.Album,
    album: props.album,
    recursive: true,
  }), [props.album]);

  let media = useMediaLookup(lookup);

  const onAlbumSearch = useCallback(() => {
    let query: Draft<Search.RelationQuery> = {
      invert: false,
      type: "compound",
      join: Join.And,
      relation: RelationType.Album,
      recursive: true,
      queries: [{
        invert: false,
        type: "field",
        field: "id",
        modifier: null,
        operator: Operator.Equal,
        value: album.id,
      }],
    };

    actions.showSearchOverlay(album.catalog.ref(), query);
  }, [actions, album]);

  return <Page
    selectedItem={props.album.id}
    pageOptions={
      [{
        id: "album-search",
        onClick: onAlbumSearch,
        label: l10n.getString("banner-search"),
      }, {
        id: "album-edit",
        onClick: onAlbumEdit,
        label: l10n.getString("banner-album-edit"),
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
