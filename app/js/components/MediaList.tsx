import React from "react";
import { connect } from "react-redux";

import { Search } from "../utils/search";
import { StoreState } from "../store/types";
import { Media, isProcessed, UnprocessedMedia } from "../api/types";
import Throbber from "./Throbber";
import MediaThumbnail from "./MediaThumbnail";
import { thumbnail, searchMedia, getMedia } from "../api/media";
import { produce, Draft } from "../utils/immer";

const POLL_TIMEOUT = 5000;

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
  mediaMap: MediaDataMap | null;
}

type AllProps = StateProps & MediaListProps;

class MediaList extends React.Component<AllProps, MediaListState> {
  private pendingSearch: number;
  private pendingProcessing: Map<string, UnprocessedMedia>;
  private pendingTimeout: NodeJS.Timeout | null;

  public constructor(props: AllProps) {
    super(props);

    this.pendingSearch = 0;
    this.pendingProcessing = new Map();
    this.pendingTimeout = null;
    this.state = {
      mediaMap: null,
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

  private async process(id: string): Promise<void> {
    try {
      let media = await getMedia(id);
      if (!isProcessed(media)) {
        return;
      }

      if (!this.pendingProcessing.has(id)) {
        // No longer need this result.
        return;
      }

      let mediaMap = this.state.mediaMap || {};
      mediaMap = produce(mediaMap, (mediaMap: Draft<MediaDataMap>) => {
        mediaMap[id].media = media;
      });

      this.setState({
        mediaMap,
      });

      this.loadThumbnail(media);
    } catch (e) {
      console.error(e);
      let mediaMap = this.state.mediaMap || {};
      mediaMap = produce(mediaMap, (mediaMap: Draft<MediaDataMap>) => {
        delete mediaMap[id];
      });

      this.setState({
        mediaMap,
      });
    }

    this.pendingProcessing.delete(id);
  }

  private async pollProcessing(): Promise<void> {
    let requests: Promise<void>[] = [];
    for (let media of this.pendingProcessing.values()) {
      requests.push(this.process(media.id));
    }

    await Promise.all(requests);

    if (this.pendingProcessing.size > 0) {
      this.pendingTimeout = setTimeout(() => {
        this.pollProcessing();
      }, POLL_TIMEOUT);
    } else {
      this.pendingTimeout = null;
    }
  }

  private async startSearch(): Promise<void> {
    this.pendingProcessing.clear();
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
    }

    let mediaMap = this.state.mediaMap || {};
    let id = ++this.pendingSearch;

    let results = await searchMedia(this.props.search);
    if (id !== this.pendingSearch) {
      return;
    }

    mediaMap = produce(mediaMap, (mediaMap: Draft<MediaDataMap>) => {
      let current = new Set(Object.keys(mediaMap));

      for (let item of results) {
        current.delete(item.id);
        if (!(item.id in mediaMap)) {
          mediaMap[item.id] = { media: item };
        } else {
          mediaMap[item.id].media = item;
        }

        if (!isProcessed(item)) {
          this.pendingProcessing.set(item.id, item);
        } else {
          this.loadThumbnail(item);
        }
      }

      for (let old of current.values()) {
        delete mediaMap[old];
      }
    });

    if (this.pendingProcessing.size > 0 && !this.pendingTimeout) {
      this.pendingTimeout = setTimeout(() => {
        this.pollProcessing();
      }, POLL_TIMEOUT);
    }

    this.setState({
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
    if (prevProps.search !== this.props.search) {
      this.startSearch();
      this.setState({ mediaMap: null });
    } else if (prevProps.stateId !== this.props.stateId) {
      this.startSearch();
    }
  }

  public render(): React.ReactNode {
    if (this.state.mediaMap) {
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
