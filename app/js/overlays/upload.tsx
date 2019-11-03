import React from "react";
import { connect } from "react-redux";
import { Localized } from "@fluent/react";
import { Metadata, Orientation, rotateClockwise90, rotateCounterClockwise90, mirrorHorizontal, mirrorVertical } from "media-metadata/lib/metadata";

import { DispatchProps, bumpState, closeOverlay } from "../store/actions";
import { Button } from "../components/Button";
import { If, Then, Else } from "../utils/Conditions";
import { uuid } from "../utils/helpers";
import Upload from "../components/Upload";
import { upload } from "../api/media";
import { Album, User, UploadMetadata } from "../api/types";
import { CatalogTreeSelector } from "../components/CatalogTree";
import Overlay from "../components/overlay";
import { FormFields, FormField } from "../components/Form";
import { parseMetadata, loadFrame, tagsToString, peopleToString, tagsFromString, peopleFromString } from "../utils/metadata";
import { proxyReactState, makeProperty, Proxyable, proxy } from "../utils/StateProxy";
import Media from "../components/Media";

export type PendingUpload = Proxyable<{
  file: File;
  uploading: boolean;
  failed: boolean;
  mimetype: string;
  width: number;
  height: number;
  thumbnail?: ImageBitmap;
  tags: string;
  people: string;
  orientation: Orientation;
}>;

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

const mapDispatchToProps = {
  bumpState,
  closeOverlay,
};

type UploadOverlayProps = {
  user: User;
  parent: Album;
} & DispatchProps<typeof mapDispatchToProps>;

type Inputs = Proxyable<{
  parent: Album;
  tags: string;
  people: string;
  uploads: Record<string, PendingUpload>;
}>;

interface UploadOverlayState {
  inputs: Inputs;
  disabled: boolean;
  selected?: PendingUpload;
  preview: string;
}

class UploadOverlay extends React.Component<UploadOverlayProps, UploadOverlayState> {
  private fileInput: React.RefObject<HTMLInputElement>;
  private inputs: Inputs;

  public constructor(props: UploadOverlayProps) {
    super(props);

    this.state = {
      disabled: false,
      inputs: {
        parent: this.props.parent,
        tags: "",
        people: "",
        uploads: proxy({}),
      },
      preview: "",
    };

    this.fileInput = React.createRef();
    this.inputs = proxyReactState(this, "inputs");
  }

  public componentWillUnmount(): void {
    if (this.state.preview) {
      URL.revokeObjectURL(this.state.preview);
    }
  }

  private async upload(id: string, pending: PendingUpload): Promise<void> {
    if (pending.uploading) {
      return;
    }
    pending.uploading = true;

    let metadata: UploadMetadata = {
      tags: tagsFromString(pending.tags).concat(tagsFromString(this.inputs.tags)),
      people: peopleFromString(pending.people).concat(peopleFromString(this.inputs.people)),
      orientation: pending.orientation,
    };

    try {
      await upload(metadata, pending.file, [this.inputs.parent]);
      delete this.inputs.uploads[id];

      this.props.bumpState();
      if (Object.keys(this.inputs.uploads).length === 0) {
        this.props.closeOverlay();
      }
    } catch (e) {
      console.error(e);
      pending.failed = true;
      pending.uploading = false;
    }
  }

  private startUploads: (() => void) = (): void => {
    for (let [id, pending] of Object.entries(this.inputs.uploads)) {
      this.upload(id, pending);
    }
  };

  private async loadFrame(id: string, file: File): Promise<void> {
    let thumbnail = await loadFrame(file, file.type);

    if (!thumbnail) {
      return;
    }

    this.inputs.uploads[id].thumbnail = thumbnail;
    this.inputs.uploads[id].width = thumbnail.width;
    this.inputs.uploads[id].height = thumbnail.height;
  }

  private addFile(file: File): void {
    let id = uuid();

    parseMetadata(file).then((metadata: Metadata | null) => {
      if (metadata) {
        let upload: PendingUpload = proxy({
          file,
          uploading: false,
          failed: false,
          mimetype: metadata.mimetype,
          width: metadata.width || -1,
          height: metadata.height || -1,
          orientation: metadata.orientation,
          tags: tagsToString(metadata.tags),
          people: peopleToString(metadata.people),
        });

        this.inputs.uploads[id] = upload;
        this.loadFrame(id, file);
      }
    });
  }

  private openFilePicker: (() => void) = (): void => {
    if (this.fileInput.current) {
      this.fileInput.current.click();
    }
  };

  private onNewFiles: (() => void) = (): void => {
    if (this.fileInput.current && this.fileInput.current.files) {
      this.addFiles(this.fileInput.current.files);
    }
  };

  private addFiles(files: Iterable<File>): void {
    for (let file of files) {
      this.addFile(file);
    }
  }

  private onUploadClick: (pending: PendingUpload) => void = (pending: PendingUpload) => {
    this.setState({
      selected: pending,
      preview: URL.createObjectURL(pending.file),
    });
  };

  private onDragEnter: ((event: React.DragEvent) => void) = (event: React.DragEvent): void => {
    let media = Array.from(event.dataTransfer.items).filter(itemIsMedia);
    if (media.length == 0) {
      return;
    }

    if (event.dataTransfer.dropEffect === "copy" || event.dataTransfer.dropEffect === "link" || event.dataTransfer.dropEffect === "move") {
      event.preventDefault();
    }
  };

  private onDragOver: ((event: React.DragEvent) => void) = (event: React.DragEvent): void => {
    this.onDragEnter(event);
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

  public renderSidebar(): React.ReactNode {
    if (!this.state.selected) {
      return <React.Fragment>
        <div className="sidebar-item">
          <Localized id="upload-tree-title"><label className="title"/></Localized>
        </div>
        <CatalogTreeSelector property={makeProperty(this.inputs, "parent")}/>
        <div id="upload-metadata" className="sidebar-item">
          <FormFields orientation="column">
            <FormField id="upload-overlay-global-tags" type="textarea" labelL10n="upload-global-tags" iconName="hashtag" disabled={this.state.disabled} property={makeProperty(this.inputs, "tags")}/>
            <FormField id="upload-overlay-global-people" type="textarea" labelL10n="upload-global-people" iconName="users" disabled={this.state.disabled} property={makeProperty(this.inputs, "people")}/>
          </FormFields>
        </div>
      </React.Fragment>;
    } else {
      let pending = this.state.selected;
      return <React.Fragment>
        <div id="upload-metadata" className="sidebar-item">
          <FormFields orientation="column">
            <FormField id="upload-overlay-tags" type="textarea" labelL10n="upload-media-tags" iconName="hashtag" disabled={this.state.disabled} property={makeProperty(pending, "tags")}/>
            <FormField id="upload-overlay-people" type="textarea" labelL10n="upload-media-people" iconName="users" disabled={this.state.disabled} property={makeProperty(pending, "people")}/>
          </FormFields>
        </div>
      </React.Fragment>;
    }
  }

  public renderSelected(pending: PendingUpload): React.ReactNode {
    function rotateLeft(): void {
      pending.orientation = rotateCounterClockwise90(pending.orientation);
    }

    function rotateRight(): void {
      pending.orientation = rotateClockwise90(pending.orientation);
    }

    function flipHorizontal(): void {
      pending.orientation = mirrorHorizontal(pending.orientation);
    }

    function flipVertical(): void {
      pending.orientation = mirrorVertical(pending.orientation);
    }

    const onClose = (): void => {
      URL.revokeObjectURL(this.state.preview);
      this.setState({
        selected: undefined,
        preview: "",
      });
    };

    return <div id="selected-upload">
      <Media mimetype={pending.mimetype} width={pending.width} height={pending.height} orientation={pending.orientation} style={{height: "100%", width: "100%" }} src={this.state.preview}/>
      <Button id="upload-preview-close" iconName="times" tooltipL10n="upload-preview-close" onClick={onClose}/>
      <div id="upload-preview-controls">
        <Button id="upload-preview-left" iconName="undo" tooltipL10n="upload-preview-left" onClick={rotateLeft}/>
        <div id="upload-preview-flip-controls">
          <Button id="upload-preview-flip-horizontal" iconName="arrows-alt-h" tooltipL10n="upload-preview-flip-horizontal" onClick={flipHorizontal}/>
          <Button id="upload-preview-flip-vertical" iconName="arrows-alt-v" tooltipL10n="upload-preview-flip-vertical" onClick={flipVertical}/>
        </div>
        <Button id="upload-preview-right" iconName="redo" tooltipL10n="upload-preview-right" onClick={rotateRight}/>
      </div>
    </div>;
  }

  public render(): React.ReactNode {
    return <Overlay title="upload-title" sidebar={this.renderSidebar()}>
      <If condition={Object.keys(this.inputs.uploads).length > 0}>
        <Then>
          <div className="media-list" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
            {Object.entries(this.inputs.uploads).map(([id, upload]: [string, PendingUpload]) => {
              return <Upload key={id} upload={upload} onClick={(): void => this.onUploadClick(upload)}/>;
            })}
          </div>
        </Then>
        <Else>
          <div className="media-list empty" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
            <Localized id="upload-drag-media">
              <p/>
            </Localized>
          </div>
        </Else>
      </If>
      <div id="upload-complete">
        <input id="fileInput" multiple={true} accept="image/jpeg,video/mp4" type="file" ref={this.fileInput} onChange={this.onNewFiles}/>
        <Button l10n="upload-add-files" onClick={this.openFilePicker}/>
        <Button l10n="upload-submit" onClick={this.startUploads}/>
      </div>
      {this.state.selected ? this.renderSelected(this.state.selected) : null}
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(UploadOverlay);
