import React, { ReactNode, Fragment } from "react";

import { Album, Catalog, Reference } from "../api/highlevel";
import Button from "../components/Button";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import Throbber from "../components/Throbber";
import { StoreState } from "../store";
import actions from "../store/actions";
import { PropsFor } from "../utils/component";
import { Search, Field, Operation } from "../utils/search";
import { BasePage, baseConnect, PageProps } from "./BasePage";
import NotFound from "./notfound";

interface PassedProps {
  album: Reference<Album>;
}

interface FromStateProps {
  album: Album;
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
class AlbumPage extends BasePage<
  PassedProps,
  typeof mapStateToProps,
  typeof mapDispatchToProps,
  AlbumPageState
> {
  public constructor(props: AlbumPageProps) {
    super(props);

    this.state = {
      catalog: props.album.catalog,
      pending: true,
    };
  }

  public componentDidMount(): void {
    if (this.state.catalog) {
      let search: Search = {
        // eslint-disable-next-line react/no-access-state-in-setstate
        catalog: this.state.catalog.ref(),
        query: {
          invert: false,
          field: Field.Album,
          operation: Operation.Includes,
          value: this.props.album.name,
        },
      };

      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        album: this.props.album,
        search,
        pending: false,
      });
    } else {
      // eslint-disable-next-line react/no-did-mount-set-state
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

  protected renderBannerButtons(): ReactNode {
    if (this.props.user && this.props.album) {
      return <Fragment>
        <Button l10n="banner-album-edit" onClick={this.onEdit}/>
        <Button l10n="banner-album-new" onClick={this.onNewAlbum}/>
        <Button l10n="banner-upload" onClick={this.onUpload}/>
      </Fragment>;
    } else {
      return null;
    }
  }

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {
      selectedItem: this.state.album,
    };
  }

  protected renderContent(): ReactNode {
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
