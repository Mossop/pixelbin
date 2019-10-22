import React from "react";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";

import { Album, Catalog } from "../api/types";
import { getAlbum, getCatalogForAlbum } from "../store/store";
import { StoreState } from "../store/types";
import { showAlbumCreateOverlay, showAlbumEditOverlay, DispatchProps, showUploadOverlay } from "../store/actions";
import NotFound from "./notfound";
import { Button } from "../components/Button";
import { BasePage, BasePageProps, baseConnect, BasePageState } from "../components/BasePage";
import { SidebarProps } from "../components/Sidebar";
import Throbber from "../components/Throbber";
import { Search, Field, Operation } from "../utils/search";
import MediaList from "../components/MediaList";

interface MatchParams {
  id: string;
}

interface StateProps {
  album?: Album;
}

interface PageState {
  album?: Album;
  catalog?: Catalog;
  search?: Search;
  pending: boolean;
}

const mapDispatchToProps = {
  showAlbumCreateOverlay,
  showAlbumEditOverlay,
  showUploadOverlay,
};

function mapStateToProps(state: StoreState, props: RouteComponentProps<MatchParams>): StateProps {
  return {
    album: getAlbum(props.match.params.id, state),
  };
}

type AlbumPageProps = BasePageProps & RouteComponentProps<MatchParams> & StateProps & DispatchProps<typeof mapDispatchToProps>;
type AlbumPageState = BasePageState & PageState;

class AlbumPage extends BasePage<AlbumPageProps, AlbumPageState> {
  public constructor(props: AlbumPageProps) {
    super(props);

    let catalog: Catalog | undefined = undefined;
    if (props.album) {
      catalog = getCatalogForAlbum(props.album);
    }
    this.state = {
      catalog,
      pending: true,
    };
  }

  public componentDidMount(): void {
    if (this.props.album && this.state.catalog) {
      let search: Search = {
        catalog: this.state.catalog,
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
      selected: this.props.match.params.id,
      album: this.state.album,
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

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(AlbumPage));
