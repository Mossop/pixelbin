import { Immutable } from "immer";
import React, { ReactNode, Fragment } from "react";

import { Album, Reference } from "../api/highlevel";
import { UserData } from "../api/types";
import Button from "../components/Button";
import MediaList from "../components/MediaList";
import Sidebar from "../components/Sidebar";
import actions from "../store/actions";
import { StoreState } from "../store/types";
import { PropsFor } from "../utils/component";
import { Search, Field, Operation } from "../utils/search";
import { AuthenticatedPage, baseConnect, PageProps } from "./BasePage";

interface PassedProps {
  album: Reference<Album>;
  user: Immutable<UserData>;
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
  search: Search;
}

type AlbumPageProps = PageProps<PassedProps, typeof mapStateToProps, typeof mapDispatchToProps>;
class AlbumPage extends AuthenticatedPage<
  PassedProps,
  typeof mapStateToProps,
  typeof mapDispatchToProps,
  AlbumPageState
> {
  public constructor(props: AlbumPageProps) {
    super(props);

    this.state = {
      search: {
        catalog: this.props.album.catalog.ref(),
        query: {
          invert: false,
          field: Field.Album,
          operation: Operation.Includes,
          value: this.props.album.name,
        },
      },
    };
  }

  public componentDidUpdate(prevProps: AlbumPageProps): void {
    if (prevProps.album !== this.props.album) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        search: {
          catalog: this.props.album.catalog.ref(),
          query: {
            invert: false,
            field: Field.Album,
            operation: Operation.Includes,
            value: this.props.album.name,
          },
        },
      });
    }
  }

  private onEdit: (() => void) = (): void => {
    this.props.showAlbumEditOverlay(this.props.album.ref());
  };

  private onNewAlbum: (() => void) = (): void => {
    this.props.showAlbumCreateOverlay(this.props.album.ref());
  };

  private onUpload: (() => void) = (): void => {
    this.props.showUploadOverlay();
  };

  protected renderBannerButtons(): ReactNode {
    return <Fragment>
      <Button l10n="banner-album-edit" onClick={this.onEdit}/>
      <Button l10n="banner-album-new" onClick={this.onNewAlbum}/>
      <Button l10n="banner-upload" onClick={this.onUpload}/>
    </Fragment>;
  }

  protected getSidebarProps(): Partial<PropsFor<typeof Sidebar>> {
    return {
      selectedItem: this.props.album,
    };
  }

  protected renderContent(): ReactNode {
    return <MediaList search={this.state.search}/>;
  }
}

export default baseConnect<PassedProps>()(AlbumPage, mapStateToProps, mapDispatchToProps);
