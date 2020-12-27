import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import type { Search } from "../../model";
import { Join, Operator, RelationType } from "../../model";
import type { Reference } from "../api/highlevel";
import { Album, useReference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import AlbumAddIcon from "../icons/AlbumAddIcon";
import AlbumDeleteIcon from "../icons/AlbumDeleteIcon";
import AlbumEditIcon from "../icons/AlbumEditIcon";
import SearchIcon from "../icons/SearchIcon";
import { useActions } from "../store/actions";
import type { AlbumMediaLookup } from "../utils/medialookup";
import { useMediaLookup, MediaLookupType } from "../utils/medialookup";
import { goBack } from "../utils/navigation";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

export interface AlbumPageProps {
  readonly album: Reference<Album>;
  readonly selectedMedia?: string;
}

export default function AlbumPage({
  album: albumRef,
  selectedMedia,
}: AlbumPageProps & AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();
  let album = useReference(Album, albumRef);

  let onAlbumEdit = useCallback(
    () => actions.showDialog({
      type: DialogType.AlbumEdit,
      album: albumRef,
    }),
    [actions, albumRef],
  );

  let onAlbumCreate = useCallback(
    () => actions.showDialog({
      type: DialogType.AlbumCreate,
      parent: albumRef,
    }),
    [albumRef, actions],
  );

  let onAlbumDelete = useCallback(
    () => actions.showDialog({
      type: DialogType.AlbumDelete,
      album: albumRef,
    }),
    [albumRef, actions],
  );

  let lookup = useMemo<AlbumMediaLookup>(() => ({
    type: MediaLookupType.Album,
    album: albumRef,
    recursive: true,
  }), [albumRef]);

  let media = useMediaLookup(lookup);

  let onMediaClick = useCallback((media: MediaState): void => {
    if (selectedMedia) {
      actions.replaceUIState({
        page: {
          type: PageType.Album,
          album: albumRef,
          selectedMedia: media.id,
        },
      });
    } else {
      actions.pushUIState({
        page: {
          type: PageType.Album,
          album: albumRef,
          selectedMedia: media.id,
        },
      });
    }
  }, [actions, selectedMedia, albumRef]);

  let onCloseMedia = useCallback((): void => {
    goBack({
      page: {
        type: PageType.Album,
        album: albumRef,
      },
    });
  }, [albumRef]);

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

    actions.showDialog({
      type: DialogType.Search,
      catalog: album.catalog.ref(),
      query,
    });
  }, [actions, album]);

  let pageOptions = useMemo(() => [{
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
  }], [l10n, onAlbumCreate, onAlbumDelete, onAlbumEdit, onAlbumSearch]);

  return <MediaListPage
    media={media}
    galleryTitle={album.name}
    selectedMedia={selectedMedia}
    selectedItem={albumRef}
    onMediaClick={onMediaClick}
    onCloseMedia={onCloseMedia}
    pageOptions={pageOptions}
  />;
}
