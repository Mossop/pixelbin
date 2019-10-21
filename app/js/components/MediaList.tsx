import React from "react";
import { connect } from "react-redux";

import { Search } from "../utils/search";
import { StoreState } from "../store/types";
import { Media } from "../api/types";
import Throbber from "./Throbber";
import MediaThumbnail from "./MediaThumbnail";
import { thumbnail, search } from "../api/media";
import produce, { Draft } from "immer";

interface MediaListProps {
  search: Search;
}

interface StateProps {
  thumbnailSize: number;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    thumbnailSize: state.settings.thumbnailSize,
  };
}

interface MediaData {
  readonly thumbnail?: ImageBitmap;
  readonly media: Media;
}

interface MediaDataMap {
  readonly [id: string]: MediaData;
}

interface MediaListState {
  pending: boolean;
  mediaMap: MediaDataMap;
}

type AllProps = StateProps & MediaListProps;

class MediaList extends React.Component<AllProps, MediaListState> {
  private pendingSearch: number;

  public constructor(props: AllProps) {
    super(props);

    this.pendingSearch = 0;
    this.state = {
      pending: true,
      mediaMap: {},
    };
  }

  private async loadThumbnail(media: Media): Promise<void> {
    let image = await thumbnail(media, this.props.thumbnailSize);

    let mediaMap = produce(this.state.mediaMap, (mediaMap: Draft<MediaDataMap>): void => {
      mediaMap[media.id].thumbnail = image;
    });

    this.setState({
      mediaMap,
    });
  }

  private async startSearch(): Promise<void> {
    let id = ++this.pendingSearch;

    let results = await search(this.props.search);
    if (id !== this.pendingSearch) {
      return;
    }

    let mediaMap: Draft<MediaDataMap> = {};
    for (let item of results) {
      this.loadThumbnail(item);
      mediaMap[item.id] = { media: item };
    }

    this.setState({
      pending: false,
      mediaMap,
    });
  }

  public componentDidMount(): void {
    this.startSearch();
  }

  public componentDidUpdate(prevProps: AllProps): void {
    if (prevProps.search !== this.props.search) {
      this.startSearch();
    }
  }

  public render(): React.ReactNode {
    if (!this.state.pending) {
      return <div className="media-list">
        {Object.values(this.state.mediaMap).map((data: MediaData) => <MediaThumbnail key={data.media.id} thumbnail={data.thumbnail} media={data.media}/>)}
      </div>;
    } else {
      return <div className="media-list empty">
        <Throbber/>
      </div>;
    }
  }
}

export default connect(mapStateToProps)(MediaList);
