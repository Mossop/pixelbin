import React from "react";
import { connect } from "react-redux";
import { Localized } from "@fluent/react";

import { DispatchProps, closeOverlay } from "../utils/actions";
import { isLoggedIn } from "../utils/helpers";
import { StoreState } from "../types";
import { UIManager } from "../utils/UIState";
import Textbox from "../components/Textbox";
import { Button } from "../components/Button";
import { If, Then, Else } from "../utils/Conditions";
import { MediaForUpload } from "../utils/metadata";
import ImageCanvas from "../content/ImageCanvas";

const MEDIA_TYPES = [
  "image/jpeg",
  "video/mp4",
];

function itemIsMedia(item: DataTransferItem): boolean {
  if (item.kind != "file") {
    return false;
  }

  return MEDIA_TYPES.includes(item.type);
}

interface StateProps {
  isLoggedIn: boolean;
}

function mapStateToProps(state: StoreState): StateProps {
  return {
    isLoggedIn: isLoggedIn(state),
  };
}

const mapDispatchToProps = {
  closeOverlay,
};

type UploadOverlayProps = {
  catalog?: string;
  album?: string;
} & StateProps & DispatchProps<typeof mapDispatchToProps>;

interface UploadOverlayState {
  media: MediaForUpload[];
}

class UploadOverlay extends UIManager<UploadOverlayProps, UploadOverlayState> {
  fileInput: React.RefObject<HTMLInputElement>;

  public constructor(props: UploadOverlayProps) {
    super(props);

    this.state = {
      media: [],
    };

    this.fileInput = React.createRef();
  }

  private async addFile(file: File): Promise<void> {
    let { parseMedia, createThumbnail } = await import(/* webpackChunkName: "metadata" */ "../utils/metadata");

    let media: MediaForUpload | null = await parseMedia(file);
    if (!media) {
      return;
    }

    let newMedia = this.state.media.slice(0);
    newMedia.push(media);
    this.setState({
      media: newMedia,
    });

    createThumbnail(file, media.metadata.mimetype).then((bitmap: ImageBitmap): void => {
      if (!media) {
        return;
      }

      media.bitmap = bitmap;
      media.metadata.width = bitmap.width;
      media.metadata.height = bitmap.height;
      this.setState({
        media: this.state.media.slice(0),
      });
    });
  }

  private openFilePicker: (() => void) = (): void => {
    if (this.fileInput.current) {
      this.fileInput.current.click();
    }
  };

  private onNewFiles: (() => void) = (): void => {
    if (this.fileInput.current && this.fileInput.current.files) {
      this.addFiles(Array.from(this.fileInput.current.files));
    }
  };

  private addFiles(files: File[]): void {
    for (let file of files) {
      this.addFile(file);
    }
  }

  private onDragEnter: ((event: React.DragEvent) => void) = (event: React.DragEvent): void => {
    let media = Array.from(event.dataTransfer.items).filter(itemIsMedia);
    if (media.length == 0) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
  };

  private onDragOver: ((event: React.DragEvent) => void) = (event: React.DragEvent): void => {
    let media = Array.from(event.dataTransfer.items).filter(itemIsMedia);
    if (media.length == 0) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
  };

  private onDrop: ((event: React.DragEvent) => void) = (event: React.DragEvent): void => {
    event.preventDefault();

    function isFile(f: File | null): f is File {
      return !!f;
    }

    let files: File[] = Array.from(event.dataTransfer.items)
      .filter(itemIsMedia)
      .map((i: DataTransferItem) => i.getAsFile())
      .filter(isFile);

    this.addFiles(files);
  };

  public renderMedia(media: MediaForUpload): React.ReactNode {
    return <div className="media" key={media.id}>
      <ImageCanvas bitmap={media.bitmap} size={150}/>
    </div>;
  }

  public renderUI(): React.ReactNode {
    return <React.Fragment>
      <div id="upload-metadata">
        <p>
          <Localized id="upload-global-tags">
            <label htmlFor="globalTags"/>
          </Localized>
        </p>
        <p>
          <Textbox id="globalTags" uiPath="globalTags"/>
        </p>
      </div>
      <div id="upload-content">
        <If condition={this.state.media.length > 0}>
          <Then>
            <div id="media-list" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
              {this.state.media.map((m: MediaForUpload) => this.renderMedia(m))}
            </div>
          </Then>
          <Else>
            <div id="media-list" className="empty" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
              <Localized id="upload-drag-media">
                <p/>
              </Localized>
            </div>
          </Else>
        </If>
        <div id="upload-complete">
          <input id="fileInput" multiple={true} accept="image/jpeg,video/mp4" type="file" ref={this.fileInput} onChange={this.onNewFiles}/>
          <Button l10n="upload-add-files" onClick={this.openFilePicker}/>
          <Button l10n="upload-upload" onClick={(): void => {}}/>
        </div>
      </div>
    </React.Fragment>;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(UploadOverlay);
