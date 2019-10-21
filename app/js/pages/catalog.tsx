import React from "react";

import { baseConnect, BasePage, BasePageProps } from "../components/BasePage";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";
import { StoreState } from "../store/types";
import { Catalog, Media } from "../api/types";
import { SidebarProps } from "../components/Sidebar";
import { Button } from "../components/Button";
import { DispatchProps, showUploadOverlay, showCatalogEditOverlay, showAlbumCreateOverlay } from "../store/actions";
import { getCatalog } from "../store/store";
import NotFound from "./notfound";
import Throbber from "../components/Throbber";
import { Search } from "../utils/search";
import { search } from "../api/media";
import { MediaThumbnail } from "../components/Media";

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

interface CatalogPageState {
  media?: Media[];
  search?: Search;
}

type CatalogPageProps = BasePageProps & RouteComponentProps<MatchParams> & StateProps & DispatchProps<typeof mapDispatchToProps>;

class CatalogPage extends BasePage<CatalogPageProps, CatalogPageState> {
  public constructor(props: CatalogPageProps) {
    super(props);

    let search: Search | undefined = undefined;
    if (this.props.user && this.props.catalog) {
      search = {
        catalog: this.props.catalog,
      };
    }

    this.state = {
      search,
    };
  }

  public async componentDidMount(): Promise<void> {
    if (!this.state.search) {
      return;
    }

    let media = await search(this.state.search);
    this.setState({
      media,
    });
  }

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

    this.props.showAlbumCreateOverlay(this.props.catalog);
  };

  private onUpload: (() => void) = (): void => {
    if (!this.props.user || !this.props.catalog) {
      return;
    }

    this.props.showUploadOverlay(this.props.catalog);
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
      selected: this.props.catalog ? this.props.catalog.id : undefined,
    };
  }

  protected renderContent(): React.ReactNode {
    if (this.props.user && this.props.catalog) {
      if (this.state.media) {
        return <div className="media-list">
          {this.state.media.map((media: Media) => <MediaThumbnail key={media.id} media={media}/>)}
        </div>;
      } else {
        return <div className="media-list empty">
          <Throbber/>
        </div>;
      }
    } else {
      return <NotFound/>;
    }
  }
}

export default baseConnect(connect(mapStateToProps, mapDispatchToProps)(CatalogPage));
