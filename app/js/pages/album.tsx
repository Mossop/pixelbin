import React from "react";

import { Album, Catalog, Reference } from "../api/highlevel";
import { BasePage, baseConnect, PageProps } from "../components/BasePage";
import Button from "../components/Button";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import Throbber from "../components/Throbber";
import actions from "../store/actions";
import { PropsFor } from "../store/component";
import { StoreState } from "../store/types";
import { Search, Field, Operation } from "../utils/search";
import NotFound from "./notfound";

interface PassedProps {
  album: Reference<Album>;
}

interface FromStateProps {
  album?: Album;
}

function mapStateToProps(state: StoreState, props: PassedProps): FromStateProps {
  return {
    album: props.album.deref(state.serverState),
  };
}

const mapDispatchToProps = {
  showAlbumCreateOverlay: actions.showAlbumCreateOverlay,
  showAlbumEditOverlay: actions.showAlbumEditOverlay,
  showUploadOverlay: actions.showUploadOverlay,
};

interface AlbumPageState {
  album?: Album;
  catalog?: Catalog;
  search?: Search;
  pending: boolean;
}

type AlbumPageProps = PageProps<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps>;
class AlbumPage extends BasePage<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps, AlbumPageState> {
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
        catalog: this.state.catalog.ref(),
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
    if (prevProps.album !== this.props.album) {
      this.componentDidMount();
    }
  }

  private onEdit: (() => void) = (): void => {
    if (!this.props.user || !this.props.album) {
      return;
    }

    this.props.showAlbumEditOverlay(this.props.album.ref());
  };

  private onNewAlbum: (() => void) = (): void => {
    if (!this.props.user || !this.props.album) {
      return;
    }

    this.props.showAlbumCreateOverlay(this.props.album.ref());
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.album) {
      return;
    }

    this.props.showUploadOverlay();
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

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {
      selectedItem: this.state.album,
    };
  }

  protected renderContent(): React.ReactNode {
    if (!this.state.pending) {
      if (this.state.search) {
        return <MediaList search={this.state.search}/>;
      } else {
        return <NotFound/>;
      }
    } else {
      return <Throbber/>;
    }
  }
}

export default baseConnect<PassedProps>()(AlbumPage, mapStateToProps, mapDispatchToProps);
