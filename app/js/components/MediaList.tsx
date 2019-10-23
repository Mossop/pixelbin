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
  onDragStart?: (event: React.DragEvent, media: Media) => void;
  search: Search;
}

interface StateProps {
  thumbnailSize: number;
  stateId: number;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    thumbnailSize: state.settings.thumbnailSize,
    stateId: state.stateId,
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

    let mediaMap = produce(this.state.mediaMap, (mediaMap: Draft<MediaDataMap>) => {
      let current = new Set(Object.keys(mediaMap));

      for (let item of results) {
        current.delete(item.id);
        if (!(item.id in mediaMap)) {
          mediaMap[item.id] = { media: item };
        } else {
          mediaMap[item.id].media = item;
        }
        this.loadThumbnail(item);
      }

      for (let old of current.values()) {
        delete mediaMap[old];
      }
    });

    this.setState({
      pending: false,
      mediaMap,
    });
  }

  private onDragStart: (event: React.DragEvent, data: MediaData) => void = (event: React.DragEvent, data: MediaData): void => {
    if (this.props.onDragStart) {
      this.props.onDragStart(event, data.media);
      return;
    }

    event.dataTransfer.setData("pixelbin/media", data.media.id);
    event.dataTransfer.effectAllowed = "link";
  };

  public componentDidMount(): void {
    this.startSearch();
  }

  public componentDidUpdate(prevProps: AllProps): void {
    if (prevProps.search !== this.props.search ||
        prevProps.stateId !== this.props.stateId) {
      this.startSearch();
    }
  }

  public render(): React.ReactNode {
    if (!this.state.pending) {
      return <div className="media-list">
        {Object.values(this.state.mediaMap).map((data: MediaData) =>
          <MediaThumbnail key={data.media.id} draggable={true} onDragStart={(event: React.DragEvent): void => this.onDragStart(event, data)}
            thumbnail={data.thumbnail} media={data.media}/>)}
      </div>;
    } else {
      return <div className="media-list empty">
        <Throbber/>
      </div>;
    }
  }
}

export default connect(mapStateToProps)(MediaList);
