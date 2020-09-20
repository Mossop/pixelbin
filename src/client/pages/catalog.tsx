import { useLocalization } from "@fluent/react";
import Typography from "@material-ui/core/Typography";
import React, { useCallback } from "react";

import { Catalog, Reference } from "../api/highlevel";
import Content from "../components/Content";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps } from "./types";

export interface CatalogPageProps {
  readonly catalog: Reference<Catalog>;
}

export default function CatalogPage(props: CatalogPageProps & AuthenticatedPageProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();

  const onCatalogEdit = useCallback(
    () => actions.showCatalogEditOverlay(props.catalog),
    [actions, props],
  );

  const onAlbumCreate = useCallback(
    () => actions.showAlbumCreateOverlay(props.catalog),
    [props, actions],
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
      <Typography variant="h1">Catalog</Typography>
    </Content>
  </Page>;
}
