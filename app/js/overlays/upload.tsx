import React from "react";
import { connect } from "react-redux";
import { Localized } from "@fluent/react";

import { DispatchProps, closeOverlay } from "../store/actions";
import { UIManager } from "../utils/UIState";
import { Button } from "../components/Button";
import { If, Then, Else } from "../utils/Conditions";
import { uuid } from "../utils/helpers";
import Upload from "../components/Upload";
import { UploadInfo, upload } from "../api/upload";
import { Catalog, Album, User } from "../api/types";
import { getCatalog } from "../store/store";
import { CatalogTreeSelector } from "../components/CatalogTree";
import Overlay from "../components/overlay";
import { FormFields, Field } from "../components/Form";

interface UploadFile {
  id: string;
  file: File;
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
  closeOverlay,
};

type UploadOverlayProps = {
  user: User;
  parent: Catalog | Album;
} & DispatchProps<typeof mapDispatchToProps>;

interface UploadOverlayState {
  media: UploadFile[];
}

class UploadOverlay extends UIManager<UploadOverlayProps, UploadOverlayState> {
  private fileInput: React.RefObject<HTMLInputElement>;

  public constructor(props: UploadOverlayProps) {
    super(props);

    this.setTextState("parent", this.props.parent.id);
    this.state = {
      media: [],
    };

    this.fileInput = React.createRef();
  }

  private upload: (() => Promise<void>[]) = (): Promise<void>[] => {
    let results: Promise<void>[] = [];

    let catalogId = this.getTextState("catalog");
    let catalog = getCatalog(catalogId);
    if (!catalog) {
      return results;
    }

    for (let media of this.state.media) {
      if (!media.ref.current) {
        continue;
      }

      let info: UploadInfo = {
        title: media.ref.current.title,
        tags: media.ref.current.tags,
        people: media.ref.current.people,
        orientation: media.ref.current.orientation,
        catalog,
      };

      results.push(upload(info, media.file));
    }

    return results;
  };

  private addFile(file: File): void {
    let upload: UploadFile = {
      id: uuid(),
      file,
      ref: React.createRef(),
    };

    let newMedia = this.state.media.slice(0);
    newMedia.push(upload);
    this.setState({ media: newMedia });
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
      <If condition={this.state.media.length > 0}>
        <Then>
          <div className="media-list" onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDrop={this.onDrop}>
            {this.state.media.map((m: UploadFile) => <Upload key={m.id} ref={m.ref} file={m.file}/>)}
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
        <Button l10n="upload-submit" onClick={this.upload}/>
      </div>
    </Overlay>;
  }
}

export default connect(undefined, mapDispatchToProps)(UploadOverlay);
