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
import { Search, Join, Field, Operation } from "../utils/search";
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

type AlbumPageParams = BasePageProps & RouteComponentProps<MatchParams> & StateProps & DispatchProps<typeof mapDispatchToProps>;
type AlbumPageState = BasePageState & PageState;

class AlbumPage extends BasePage<AlbumPageParams, AlbumPageState> {
  public constructor(props: AlbumPageParams) {
    super(props);

    let catalog: Catalog | undefined = undefined;
    if (props.album) {
      catalog = getCatalogForAlbum(props.album);
    }
    this.state = {
      album: props.album,
      catalog,
      pending: !props.album,
    };
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
    };
  }

  protected renderContent(): React.ReactNode {
    if (!this.state.pending) {
      if (this.state.album && this.state.catalog) {
        let search: Search = {
          catalog: this.state.catalog,
          query: {
            invert: false,
            join: Join.And,
            queries: [{
              field: {
                invert: false,
                field: Field.Album,
                operation: Operation.Includes,
                value: this.state.album.name,
              },
            }],
          },
        };
        return <MediaList search={search}/>;
      } else {
        return <NotFound/>;
      }
    } else {
      return <Throbber/>;
    }
  }
}

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(AlbumPage));
