import { useLocalization } from "@fluent/react";
import Button from "@material-ui/core/Button";
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
    bannerButtons={
      <React.Fragment>
        <Button
          id="button-banner-catalog-edit"
          color="inherit"
          onClick={onCatalogEdit}
        >
          {l10n.getString("banner-catalog-edit")}
        </Button>
        <Button
          id="button-banner-album-create"
          color="inherit"
          onClick={onAlbumCreate}
        >
          {l10n.getString("banner-album-new")}
        </Button>
      </React.Fragment>
    }
  >
    <Content>
      <Typography variant="h1">Catalog</Typography>
    </Content>
  </Page>;
}
