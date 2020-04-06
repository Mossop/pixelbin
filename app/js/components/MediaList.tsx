import { produce, Draft } from "immer";
import React, { PureComponent, ReactNode } from "react";

import { mediaRef } from "../api/highlevel";
import {
  thumbnail,
  searchMedia,
  getMedia,
  isProcessed,
  ProcessedMediaData,
  MediaData,
} from "../api/media";
import { connect, ComponentProps } from "../store/component";
import { StoreState } from "../store/types";
import { Search } from "../utils/search";
import MediaThumbnail from "./MediaThumbnail";
import Throbber from "./Throbber";

const POLL_TIMEOUT = 5000;

interface ListThumbnailPassedProps {
  onDragStart: (event: React.DragEvent, data: ItemData) => void;
  data: ItemData;
}

class ListThumbnail extends PureComponent<ComponentProps<ListThumbnailPassedProps>> {
  private onDragStart = (event: React.DragEvent): void => {
    this.props.onDragStart(event, this.props.data);
  };

  public render(): ReactNode {
    return <MediaThumbnail
      key={this.props.data.media.id}
      draggable={true}
      onDragStart={this.onDragStart}
      thumbnail={this.props.data.thumbnail}
      media={this.props.data.media}
    />;
  }
}

interface ItemData {
  readonly thumbnail?: ImageBitmap;
  readonly media: MediaData;
}

interface MediaDataMap {
  readonly [id: string]: ItemData;
}

interface PassedProps {
  onDragStart?: (event: React.DragEvent, media: MediaData) => void;
  search: Search;
}

interface FromStateProps {
  thumbnailSize: number;
  stateId: number;
}

function mapStateToProps(state: StoreState): FromStateProps {
  return {
    thumbnailSize: state.settings.thumbnailSize,
    stateId: state.stateId,
  };
}

interface MediaListState {
  mediaMap: MediaDataMap | null;
}
type MediaListProps = ComponentProps<PassedProps, typeof mapStateToProps>;
class MediaList extends PureComponent<MediaListProps, MediaListState> {
  private pendingSearch: number;
  private pendingProcessing: Map<string, MediaData>;
  private pendingTimeout: NodeJS.Timeout | null;

  public constructor(props: MediaListProps) {
    super(props);

    this.pendingSearch = 0;
    this.pendingProcessing = new Map();
    this.pendingTimeout = null;
    this.state = {
      mediaMap: null,
    };
  }

  private async loadThumbnail(media: ProcessedMediaData): Promise<void> {
    let image = await thumbnail(mediaRef(media), this.props.thumbnailSize);

    // eslint-disable-next-line react/no-access-state-in-setstate
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
      let processed: ProcessedMediaData = media;

      if (!this.pendingProcessing.has(id)) {
        // No longer need this result.
        return;
      }

      // eslint-disable-next-line react/no-access-state-in-setstate
      let mediaMap = this.state.mediaMap ?? {};
      mediaMap = produce(mediaMap, (mediaMap: Draft<MediaDataMap>): void => {
        mediaMap[id].media = processed;
      });

      this.setState({
        mediaMap,
      });

      this.loadThumbnail(media);
    } catch (e) {
      console.error(e);

      // eslint-disable-next-line react/no-access-state-in-setstate
      let mediaMap = this.state.mediaMap ?? {};
      mediaMap = produce(mediaMap, (mediaMap: Draft<MediaDataMap>): void => {
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
      this.pendingTimeout = setTimeout((): void => {
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

    // eslint-disable-next-line react/no-access-state-in-setstate
    let mediaMap = this.state.mediaMap ?? {};
    let id = ++this.pendingSearch;

    let results = await searchMedia(this.props.search);
    if (id !== this.pendingSearch) {
      return;
    }

    mediaMap = produce(mediaMap, (mediaMap: Draft<MediaDataMap>): void => {
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
      this.pendingTimeout = setTimeout((): void => {
        this.pollProcessing();
      }, POLL_TIMEOUT);
    }

    this.setState({
      mediaMap,
    });
  }

  private onDragStart = (event: React.DragEvent, data: ItemData): void => {
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

  public componentDidUpdate(prevProps: MediaListProps): void {
    if (prevProps.search !== this.props.search) {
      this.startSearch();
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ mediaMap: null });
    } else if (prevProps.stateId !== this.props.stateId) {
      this.startSearch();
    }
  }

  public render(): ReactNode {
    if (this.state.mediaMap) {
      return <div className="media-list">
        {
          Object.values(this.state.mediaMap).map((data: ItemData): ReactNode =>
            <ListThumbnail key={data.media.id} data={data} onDragStart={this.onDragStart}/>)
        }
      </div>;
    } else {
      return <div className="media-list empty">
        <Throbber/>
      </div>;
    }
  }
}

export default connect<PassedProps>()(MediaList, mapStateToProps);
