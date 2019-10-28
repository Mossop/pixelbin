import React from "react";
import { connect } from "react-redux";
import { Localized } from "@fluent/react";

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
import { Metadata } from "media-metadata/lib/metadata";
import { parseMetadata, loadPreview } from "../utils/metadata";
import { MapState, ReactInputs, InputGroupMap, InputGroup } from "../utils/InputState";

export interface PendingUpload {
  file: File;
  uploading: boolean;
  failed: boolean;
  thumbnail?: ImageBitmap;
  metadata: UploadMetadata;
  ref: React.RefObject<Upload>;
}

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

interface Inputs {
  parent: Album;
  globalTags: string;
  uploads: MapState<PendingUpload>;
}

interface UploadOverlayState {
  inputs: Inputs;
  disabled: boolean;
}

class UploadOverlay extends ReactInputs<Inputs, UploadOverlayProps, UploadOverlayState> {
  private fileInput: React.RefObject<HTMLInputElement>;
  private uploads: InputGroupMap<PendingUpload>;

  public constructor(props: UploadOverlayProps) {
    super(props);

    this.state = {
      disabled: false,
      inputs: {
        parent: this.props.parent,
        globalTags: "",
        uploads: {},
      },
    };

    this.fileInput = React.createRef();
    this.uploads = new InputGroupMap(this.getInputState("uploads"));
  }

  private async upload(id: string, pending: InputGroup<PendingUpload>): Promise<void> {
    if (pending.getInputValue("uploading")) {
      return;
    }
    pending.setInputValue("uploading", true);

    // TODO add global metadata.

    try {
      await upload(pending.getInputValue("metadata"), pending.getInputValue("file"), [this.state.inputs.parent]);
      this.uploads.delete(id);

      this.props.bumpState();
      if (this.uploads.length === 0) {
        this.props.closeOverlay();
      }
    } catch (e) {
      console.error(e);
      pending.setInputValue("failed", true);
      pending.setInputValue("uploading", false);
    }
  }

  private startUploads: (() => void) = (): void => {
    for (let id of this.uploads.keys()) {
      this.upload(id, this.uploads.getInputGroup(id));
    }
  };

  private async loadPreview(id: string, file: File): Promise<void> {
    let preview = await loadPreview(file, file.type);

    if (!preview) {
      return;
    }

    let found: ImageBitmap = preview;
    let pending = this.uploads.getInputGroup(id);
    pending.setInputValue("thumbnail", found);
  }

  private async loadThumbnail(id: string, blob: Blob): Promise<void> {
    let thumbnail = await createImageBitmap(blob);
    let pending = this.uploads.getInputGroup(id);
    if (!pending.getInputValue("thumbnail")) {
      pending.setInputValue("thumbnail", thumbnail);
    }
  }

  private addFile(file: File): void {
    let id = uuid();

    parseMetadata(file).then((metadata: Metadata | null) => {
      if (metadata) {
        let uploadMeta: UploadMetadata = {
          orientation: metadata.orientation,
          tags: metadata.tags,
          people: metadata.people,
        };

        let upload: PendingUpload = {
          file,
          uploading: false,
          failed: false,
          metadata: uploadMeta,
          ref: React.createRef(),
        };

        this.uploads.set(id, upload);

        if (metadata.thumbnail) {
          this.loadThumbnail(id, new Blob([metadata.thumbnail]));
        }
        this.loadPreview(id, file);
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

  private onDragEnter: ((event: React.DragEvent) => void) = (event: React.DragEvent): void => {
    let media = Array.from(event.dataTransfer.items).filter(itemIsMedia);
    console.log("Here", media.length, event.dataTransfer.dropEffect);
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
    return <React.Fragment>
      <div className="sidebar-item">
        <Localized id="upload-tree-title"><label className="title"/></Localized>
      </div>
      <CatalogTreeSelector inputs={this.getInputState("parent")}/>
      <div id="upload-metadata" className="sidebar-item">
        <FormFields orientation="column">
          <FormField id="globalTags" type="text" labelL10n="upload-global-tags" iconName="hashtag" disabled={this.state.disabled} inputs={this.getInputState("globalTags")}/>
        </FormFields>
      </div>
    </React.Fragment>;
  }

  public renderUI(): React.ReactNode {
    return <Overlay title="upload-title" sidebar={this.renderSidebar()}>
      <If condition={this.uploads.length > 0}>
        <Then>
          <div className="media-list" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
            {Object.entries(this.state.inputs.uploads).map(([id, upload]: [string, PendingUpload]) => {
              return <Upload key={id} upload={upload}/>;
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
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(UploadOverlay);
