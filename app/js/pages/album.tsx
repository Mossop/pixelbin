import React from "react";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";

import { Album, Catalog } from "../api/types";
import { getCatalogForAlbum } from "../store/store";
import { StoreState } from "../store/types";
import { showAlbumCreateOverlay, showAlbumEditOverlay, DispatchProps, showUploadOverlay } from "../store/actions";
import NotFound from "./notfound";
import { Button } from "../components/Button";
import { BasePage, BasePageProps, baseConnect, BasePageState } from "../components/BasePage";
import { SidebarProps } from "../content/Sidebar";
import Throbber from "../components/Throbber";

interface MatchParams {
  id: string;
}

interface StateProps {
  catalog?: Catalog;
  album?: Album;
}

interface PageState {
  album?: Album;
  pending: boolean;
}

const mapDispatchToProps = {
  showAlbumCreateOverlay,
  showAlbumEditOverlay,
  showUploadOverlay,
};

function mapStateToProps(state: StoreState, props: RouteComponentProps<MatchParams>): StateProps {
  let catalog = getCatalogForAlbum(props.match.params.id, state);
  let album = catalog ? catalog.albums[props.match.params.id] : undefined;
  return {
    album,
    catalog,
  };
}

type AlbumPageParams = BasePageProps & RouteComponentProps<MatchParams> & StateProps & DispatchProps<typeof mapDispatchToProps>;
type AlbumPageState = BasePageState & PageState;

class AlbumPage extends BasePage<AlbumPageParams, AlbumPageState> {
  public constructor(props: AlbumPageParams) {
    super(props);

    this.state = {
      album: props.album,
      pending: !!props.album,
    };
  }

  private onEdit: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog || !this.props.album) {
      return;
    }

    this.props.showAlbumEditOverlay(this.props.catalog, this.props.album);
  };

  private onNewAlbum: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog || !this.props.album) {
      return;
    }

    this.props.showAlbumCreateOverlay(this.props.catalog, this.props.album);
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog || !this.props.album) {
      return;
    }

    this.props.showUploadOverlay(this.props.catalog, this.props.album);
  };

  protected renderBannerButtons(): React.ReactNode {
    if (this.props.user && this.props.catalog && this.props.album) {
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
    };
  }

  protected renderContent(): React.ReactNode {
    if (this.state.pending) {
      if (this.state.album) {
        return <h1>Album!</h1>;
      } else {
        return <NotFound/>;
      }
    } else {
      return <Throbber/>;
    }
  }
}

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(AlbumPage));
