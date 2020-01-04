import React from "react";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";

import { baseConnect, BasePage, BasePageProps } from "../components/BasePage";
import { StoreState } from "../store/types";
import { Catalog, Media } from "../api/types";
import { SidebarProps } from "../components/Sidebar";
import { Button } from "../components/Button";
import { DispatchProps, showUploadOverlay, showCatalogEditOverlay, showAlbumCreateOverlay } from "../store/actions";
import { getCatalog, getCatalogRoot } from "../store/store";
import MediaList from "../components/MediaList";
import { Search, Field, Operation } from "../utils/search";
import NotFound from "./notfound";

interface MatchParams {
  id: string;
}

interface StateProps {
  catalog: Catalog | undefined;
}

function mapStateToProps(state: StoreState, props: RouteComponentProps<MatchParams>): StateProps {
  return {
    catalog: getCatalog(props.match.params.id, state),
  };
}

const mapDispatchToProps = {
  showUploadOverlay,
  showCatalogEditOverlay,
  showAlbumCreateOverlay,
};

type CatalogPageProps = BasePageProps & RouteComponentProps<MatchParams> & StateProps & DispatchProps<typeof mapDispatchToProps>;

class CatalogPage extends BasePage<CatalogPageProps> {
  private onEdit: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showCatalogEditOverlay(this.props.catalog);
  };

  private onNewAlbum: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showAlbumCreateOverlay(getCatalogRoot(this.props.catalog));
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showUploadOverlay(getCatalogRoot(this.props.catalog));
  };

  protected renderBannerButtons(): React.ReactNode {
    if (this.props.user && this.props.catalog) {
      return <React.Fragment>
        <Button l10n="banner-catalog-edit" onClick={this.onEdit}/>
        <Button l10n="banner-album-new" onClick={this.onNewAlbum}/>
        <Button l10n="banner-upload" onClick={this.onUpload}/>
      </React.Fragment>;
    } else {
      return null;
    }
  }

  protected getSidebarProps(): Partial<SidebarProps> {
    return {
      album: this.props.catalog ? getCatalogRoot(this.props.catalog) : undefined,
    };
  }

  private onDragStart: (event: React.DragEvent, media: Media) => void = (event: React.DragEvent, media: Media): void => {
    event.dataTransfer.setData("pixelbin/media", media.id);
    if (this.props.catalog) {
      event.dataTransfer.setData("pixelbin/album-media", JSON.stringify({ media: media.id, album: this.props.catalog.root }));
      event.dataTransfer.effectAllowed = "copyMove";
    } else {
      event.dataTransfer.effectAllowed = "copy";
    }
  };

  protected renderContent(): React.ReactNode {
    if (this.props.user && this.props.catalog) {
      let search: Search = {
        catalog: this.props.catalog,
        query: {
          invert: false,
          field: Field.Album,
          operation: Operation.Includes,
          value: getCatalogRoot(this.props.catalog).name,
        },
      };
      return <MediaList onDragStart={this.onDragStart} search={search}/>;
    } else {
      return <NotFound/>;
    }
  }
}

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(CatalogPage));
