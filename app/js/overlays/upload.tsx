import React from "react";
import { connect } from "react-redux";
import { Localized } from "@fluent/react";

import { DispatchProps, bumpState, closeOverlay } from "../store/actions";
import { UIManager } from "../utils/UIState";
import { Button } from "../components/Button";
import { If, Then, Else } from "../utils/Conditions";
import { uuid } from "../utils/helpers";
import Upload from "../components/Upload";
import { upload, addToAlbums } from "../api/media";
import { Catalog, Album, User, UploadMetadata } from "../api/types";
import { getParent, getCatalogForAlbum } from "../store/store";
import { CatalogTreeSelector } from "../components/CatalogTree";
import Overlay from "../components/overlay";
import { FormFields, Field } from "../components/Form";
import { produce, Immutable } from "immer";
import { Metadata } from "media-metadata/lib/metadata";
import { parseMetadata, loadPreview } from "../utils/metadata";

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
  parent: Catalog | Album;
} & DispatchProps<typeof mapDispatchToProps>;

interface Uploads {
  [id: string]: PendingUpload;
}

interface Refs {
  [id: string]: React.RefObject<Upload>;
}

interface UploadOverlayState {
  uploads: Immutable<Uploads>;
}

class UploadOverlay extends UIManager<UploadOverlayProps, UploadOverlayState> {
  private fileInput: React.RefObject<HTMLInputElement>;
  private uploadRefs: Refs;

  public constructor(props: UploadOverlayProps) {
    super(props);

    this.setTextState("parent", this.props.parent.id);
    this.uploadRefs = {};
    this.state = {
      uploads: {},
    };

    this.fileInput = React.createRef();
  }

  private async upload(catalog: Catalog, parentAlbum: Album | undefined, id: string, pending: Immutable<PendingUpload>): Promise<void> {
    if (pending.uploading) {
      return;
    }

    let uploads = produce(this.state.uploads, (uploads: Uploads): void => {
      uploads[id].uploading = true;
    });
    this.setState({ uploads });
    // pending is outdated here, doesn't matter much though.

    // TODO add global metadata.

    try {
      let media = await upload(catalog, pending.metadata, pending.file);
      if (parentAlbum) {
        // Not sure what to do if this fails.
        addToAlbums(media, [parentAlbum]);
      }

      let uploads = produce(this.state.uploads, (uploads: Uploads): void => {
        delete uploads[id];
      });
      this.setState({ uploads });

      this.props.bumpState();
    } catch (e) {
      console.error(e);
      let uploads = produce(this.state.uploads, (uploads: Uploads): void => {
        uploads[id].failed = true;
        uploads[id].uploading = false;
      });
      this.setState({ uploads });
    }
  }

  private startUploads: (() => void) = (): void => {
    let parent = getParent(this.getTextState("parent"));
    if (!parent) {
      return;
    }

    let catalog: Catalog;
    let parentAlbum: Album | undefined;
    if ("albums" in parent) {
      catalog = parent;
      parentAlbum = undefined;
    } else {
      parentAlbum = parent;
      let check = getCatalogForAlbum(parent);
      if (!check) {
        return;
      }
      catalog = check;
    }

    for (let [id, upload] of Object.entries(this.state.uploads)) {
      this.upload(catalog, parentAlbum, id, upload);
    }
  };

  private async loadPreview(id: string, file: File): Promise<void> {
    let preview = await loadPreview(file, file.type);

    if (!preview) {
      return;
    }

    let found: ImageBitmap = preview;

    let uploads = produce(this.state.uploads, (uploads: Uploads): void => {
      if (!(id in uploads)) {
        return;
      }

      uploads[id].thumbnail = found;
    });

    this.setState({ uploads });
  }

  private async loadThumbnail(id: string, blob: Blob): Promise<void> {
    let thumbnail = await createImageBitmap(blob);

    let uploads = produce(this.state.uploads, (uploads: Uploads): void => {
      if (!(id in uploads)) {
        return;
      }

      if (uploads[id].thumbnail) {
        return;
      }

      uploads[id].thumbnail = thumbnail;
    });

    this.setState({ uploads });
  }

  private addFile(file: File): void {
    let id = uuid();
    this.uploadRefs[id] = React.createRef<Upload>();

    parseMetadata(file).then((metadata: Metadata | null) => {
      if (metadata) {
        let uploadMeta: UploadMetadata = {
          orientation: metadata.orientation,
          tags: metadata.tags,
          people: metadata.people,
        };

        let uploads = produce(this.state.uploads, (uploads: Uploads) => {
          let upload: PendingUpload = {
            file,
            uploading: false,
            failed: false,
            metadata: uploadMeta,
            ref: React.createRef(),
          };

          uploads[id] = upload;
        });

        this.setState({ uploads });

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
    if (media.length == 0) {
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
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
    let fields: Field[] = [{
      fieldType: "textbox",
      uiPath: "globalTags",
      labelL10n: "upload-global-tags",
    }];

    return <React.Fragment>
      <div id="upload-metadata" className="sidebar-item">
        <FormFields orientation="column" fields={fields}/>
      </div>
      <div className="sidebar-item">
        <Localized id="upload-tree-title"><label className="title"/></Localized>
      </div>
      <CatalogTreeSelector uiPath="parent"/>
    </React.Fragment>;
  }

  public renderUI(): React.ReactNode {
    return <Overlay title="upload-title" sidebar={this.renderSidebar()}>
      <If condition={Object.keys(this.state.uploads).length > 0}>
        <Then>
          <div className="media-list" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
            {Object.entries(this.state.uploads).map(([id, upload]: [string, Immutable<PendingUpload>]) => {
              return <Upload ref={this.uploadRefs[id]} key={id} upload={upload}/>;
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
