import React from "react";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";

import { MediaData } from "../api/media";
import { StoreState } from "../store/types";
import { showAlbumCreateOverlay, showAlbumEditOverlay, showUploadOverlay } from "../store/actions";
import { Button } from "../components/Button";
import { BasePage, baseConnect, BasePageState, BasePageProps } from "../components/BasePage";
import { PassedProps as SidebarProps } from "../components/Sidebar";
import Throbber from "../components/Throbber";
import { Search, Field, Operation } from "../utils/search";
import MediaList from "../components/MediaList";
import NotFound from "./notfound";
import { ComponentProps } from "../components/shared";
import { Album, Catalog } from "../api/highlevel";
import { safe } from "../utils/exception";

interface MatchParams {
  id: string;
}

type PassedProps = BasePageProps & RouteComponentProps<MatchParams>;

interface FromStateProps {
  album?: Album;
}

function mapStateToProps(state: StoreState, props: PassedProps): FromStateProps {
  return {
    album: safe(() => Album.fromState(state, props.match.params.id)),
  };
}

const mapDispatchToProps = {
  showAlbumCreateOverlay,
  showAlbumEditOverlay,
  showUploadOverlay,
};

type AlbumPageState = BasePageState & {
  album?: Album;
  catalog?: Catalog;
  search?: Search;
  pending: boolean;
};

type AlbumPageProps = ComponentProps<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps>;
class AlbumPage extends BasePage<AlbumPageProps, AlbumPageState> {
  public constructor(props: AlbumPageProps) {
    super(props);

    this.state = {
      catalog: props.album?.catalog,
      pending: true,
    };
  }

  public componentDidMount(): void {
    if (this.props.album && this.state.catalog) {
      let search: Search = {
        catalog: this.state.catalog.id,
        query: {
          invert: false,
          field: Field.Album,
          operation: Operation.Includes,
          value: this.props.album.name,
        },
      };

      this.setState({
        album: this.props.album,
        search,
        pending: false,
      });
    } else {
      this.setState({
        album: undefined,
        search: undefined,
        pending: true,
      });
    }
  }

  public componentDidUpdate(prevProps: AlbumPageProps): void {
    if (prevProps.match.params.id !== this.props.match.params.id) {
      this.componentDidMount();
    }
  }

  private onEdit: (() => void) = (): void => {
    if (!this.props.user || !this.props.album) {
      return;
    }

    this.props.showAlbumEditOverlay(this.props.album);
  };

  private onNewAlbum: (() => void) = (): void => {
    if (!this.props.user || !this.props.album) {
      return;
    }

    this.props.showAlbumCreateOverlay(this.props.album);
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.album) {
      return;
    }

    this.props.showUploadOverlay(this.props.album);
  };

  private onDragStart: (event: React.DragEvent, media: MediaData) => void = (event: React.DragEvent, media: MediaData): void => {
    event.dataTransfer.setData("pixelbin/media", media.id);
    if (this.props.album) {
      event.dataTransfer.setData("pixelbin/album-media", JSON.stringify({ media: media.id, album: this.props.album.id }));
      event.dataTransfer.effectAllowed = "copyMove";
    } else {
      event.dataTransfer.effectAllowed = "copy";
    }
  };

  protected renderBannerButtons(): React.ReactNode {
    if (this.props.user && this.props.album) {
      return <React.Fragment>
        <Button l10n="banner-album-edit" onClick={this.onEdit}/>
        <Button l10n="banner-album-new" onClick={this.onNewAlbum}/>
        <Button l10n="banner-upload" onClick={this.onUpload}/>
      </React.Fragment>;
    } else {
      return null;
    }
  }

  protected getSidebarProps(): Partial<SidebarProps> {
    return {
      selectedAlbum: this.state.album,
    };
  }

  protected renderContent(): React.ReactNode {
    if (!this.state.pending) {
      if (this.state.search) {
        return <MediaList onDragStart={this.onDragStart} search={this.state.search}/>;
      } else {
        return <NotFound/>;
      }
    } else {
      return <Throbber/>;
    }
  }
}

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(AlbumPage));
