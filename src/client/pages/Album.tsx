import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import React, { useCallback, useMemo } from "react";

import type { Search } from "../../model";
import { Join, Operator, RelationType } from "../../model";
import type { Album, Reference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import AlbumAddIcon from "../icons/AlbumAddIcon";
import AlbumDeleteIcon from "../icons/AlbumDeleteIcon";
import AlbumEditIcon from "../icons/AlbumEditIcon";
import SearchIcon from "../icons/SearchIcon";
import { OverlayType } from "../overlays/types";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import type { StoreState } from "../store/types";
import type { AlbumMediaLookup } from "../utils/medialookup";
import { MediaLookupType, useMediaLookup } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

export interface AlbumPageProps {
  readonly album: Reference<Album>;
}

export default function AlbumPage(props: AlbumPageProps & AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();
  let album = useSelector((state: StoreState) => props.album.deref(state.serverState));

  let onAlbumEdit = useCallback(
    () => actions.showOverlay({
      type: OverlayType.AlbumEdit,
      album: props.album,
    }),
    [actions, props.album],
  );

  let onAlbumCreate = useCallback(
    () => actions.showOverlay({
      type: OverlayType.AlbumCreate,
      parent: props.album,
    }),
    [props.album, actions],
  );

  let onAlbumDelete = useCallback(
    () => actions.showOverlay({
      type: OverlayType.AlbumDelete,
      album: props.album,
    }),
    [props.album, actions],
  );

  let lookup = useMemo<AlbumMediaLookup>(() => ({
    type: MediaLookupType.Album,
    album: props.album,
    recursive: true,
  }), [props.album]);

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

  let onAlbumSearch = useCallback(() => {
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

    actions.showOverlay({
      type: OverlayType.Search,
      catalog: album.catalog.ref(),
      query,
    });
  }, [actions, album]);

  return <Page
    title={album.name}
    selectedItem={props.album.id}
    pageOptions={
      [{
        id: "album-search",
        onClick: onAlbumSearch,
        icon: <SearchIcon/>,
        label: l10n.getString("banner-search"),
      }, {
        id: "album-create",
        onClick: onAlbumCreate,
        icon: <AlbumAddIcon/>,
        label: l10n.getString("banner-album-new"),
      }, {
        id: "album-edit",
        onClick: onAlbumEdit,
        icon: <AlbumEditIcon/>,
        label: l10n.getString("banner-album-edit"),
      }, {
        id: "album-delete",
        onClick: onAlbumDelete,
        icon: <AlbumDeleteIcon/>,
        label: l10n.getString("banner-album-delete"),
      }]
    }
  >
    <Content>
      <MediaGallery media={media} onClick={onMediaClick}/>
    </Content>
  </Page>;
}
