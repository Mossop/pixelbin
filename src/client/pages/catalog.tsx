import { useLocalization } from "@fluent/react";
import Typography from "@material-ui/core/Typography";
import React, { useCallback } from "react";

import { Catalog, Reference } from "../api/highlevel";
import { UserState } from "../api/types";
import Content from "../components/Content";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import { ReactResult } from "../utils/types";

export interface CatalogPageProps {
  catalog: Reference<Catalog>;
  user: UserState;
}

export default function CatalogPage(props: CatalogPageProps): ReactResult {
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
