import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import type { Search } from "../../model";
import { Join } from "../../model";
import type { Reference } from "../api/highlevel";
import { useReference, Catalog } from "../api/highlevel";
import type { MediaState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import AlbumAddIcon from "../icons/AlbumAddIcon";
import CatalogEditIcon from "../icons/CatalogEditIcon";
import SearchIcon from "../icons/SearchIcon";
import { useActions } from "../store/actions";
import type { UIState } from "../store/types";
import type { CatalogMediaLookup } from "../utils/medialookup";
import { useMediaLookup, MediaLookupType } from "../utils/medialookup";
import { goBack } from "../utils/navigation";
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
  let catalog = useReference(Catalog, catalogRef);

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

  let getMediaUIState = useCallback((media: MediaState): Draft<UIState> => {
    return {
      page: {
        type: PageType.Catalog,
        catalog: catalogRef,
        selectedMedia: media.id,
      },
    };
  }, [catalogRef]);

  let onCloseMedia = useCallback(() => {
    goBack({
      page: {
        type: PageType.Catalog,
        catalog: catalogRef,
      },
    });
  }, [catalogRef]);

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

  let pageOptions = useMemo(() => [{
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
  }], [l10n, onAlbumCreate, onCatalogEdit, onCatalogSearch]);

  return <MediaListPage
    galleryTitle={catalog.name}
    selectedItem={catalogRef}
    selectedMedia={selectedMedia}
    media={media}
    getMediaUIState={getMediaUIState}
    onCloseMedia={onCloseMedia}
    pageOptions={pageOptions}
  />;
}
