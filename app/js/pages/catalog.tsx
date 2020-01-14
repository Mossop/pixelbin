import React from "react";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";

import { baseConnect, BasePage, BasePageProps } from "../components/BasePage";
import { StoreState } from "../store/types";
import { MediaData } from "../api/media";
import { PassedProps as SidebarProps } from "../components/Sidebar";
import { Button } from "../components/Button";
import { showUploadOverlay, showCatalogEditOverlay, showAlbumCreateOverlay } from "../store/actions";
import MediaList from "../components/MediaList";
import { Search, Field, Operation } from "../utils/search";
import NotFound from "./notfound";
import { ComponentProps } from "../components/shared";
import { Catalog } from "../api/highlevel";
import { safe } from "../utils/exception";

interface MatchParams {
  id: string;
}

type PassedProps = BasePageProps & RouteComponentProps<MatchParams>;

interface FromStateProps {
  catalog: Catalog | undefined;
}

function mapStateToProps(state: StoreState, props: RouteComponentProps<MatchParams>): FromStateProps {
  return {
    catalog: safe(() => Catalog.fromState(state, props.match.params.id)),
  };
}

const mapDispatchToProps = {
  showUploadOverlay,
  showCatalogEditOverlay,
  showAlbumCreateOverlay,
};

type CatalogPageProps = ComponentProps<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps>;
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

    this.props.showAlbumCreateOverlay(this.props.catalog.root);
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showUploadOverlay(this.props.catalog.root);
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
      selectedAlbum: this.props.catalog?.root,
    };
  }

  private onDragStart: (event: React.DragEvent, media: MediaData) => void = (event: React.DragEvent, media: MediaData): void => {
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
        catalog: this.props.catalog.id,
        query: {
          invert: false,
          field: Field.Album,
          operation: Operation.Includes,
          value: this.props.catalog.root.name,
        },
      };
      return <MediaList onDragStart={this.onDragStart} search={search}/>;
    } else {
      return <NotFound/>;
    }
  }
}

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(CatalogPage));
