import { Localized } from "@fluent/react";
import {
  Orientation,
  rotateClockwise90,
  rotateCounterClockwise90,
  mirrorHorizontal,
  mirrorVertical,
} from "media-metadata";
import React, { Fragment, PureComponent, createRef, ReactNode, RefObject } from "react";

import { Reference, Catalog, Derefer, dereferencer, Tag, Person } from "../api/highlevel";
import { createMedia, MediaTarget } from "../api/media";
import { setOrientation } from "../api/metadata";
import { MediaCreateData } from "../api/types";
import Button from "../components/Button";
import { FormFields, FormField } from "../components/Form";
import Media from "../components/Media";
import Overlay from "../components/Overlay";
import { MediaTargetSelector } from "../components/SiteTree";
import Upload from "../components/Upload";
import actions from "../store/actions";
import { StoreState } from "../store/types";
import { connect, ComponentProps } from "../utils/component";
import { If, Then, Else } from "../utils/Conditions";
import { exception, ErrorCode } from "../utils/exception";
import { uuid } from "../utils/helpers";
import {
  parseMetadata,
  loadFrame,
  tagsToString,
  peopleToString,
  tagsFromString,
  peopleFromString,
  areDimensionsFlipped,
} from "../utils/metadata";
import { proxyReactState, makeProperty, proxy } from "../utils/StateProxy";

export interface PendingUpload {
  file: File;
  uploading: boolean;
  failed: boolean;
  mimetype: string;
  width: number;
  height: number;
  thumbnail?: ImageBitmap;
  tags: string;
  people: string;
  orientation?: Orientation;
  thumbnailOrientation?: Orientation;
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

interface InputFields {
  target: Reference<MediaTarget> | undefined;
  tags: string;
  people: string;
  uploads: Record<string, PendingUpload>;
}

interface PassedProps {
  target?: Reference<MediaTarget>;
}

interface FromStateProps {
  target: MediaTarget | undefined;
  deref: Derefer;
}

function mapStateToProps(state: StoreState, ownProps: PassedProps): FromStateProps {
  return {
    target: ownProps.target?.deref(state.serverState),
    deref: dereferencer(state.serverState),
  };
}

const mapDispatchToProps = {
  bumpState: actions.bumpState,
  closeOverlay: actions.closeOverlay,
};

interface UploadOverlayState {
  inputs: InputFields;
  disabled: boolean;
  selected?: PendingUpload;
  preview: string;
}

type UploadOverlayProps = ComponentProps<
  PassedProps,
  typeof mapStateToProps,
  typeof mapDispatchToProps
>;
class UploadOverlay extends PureComponent<UploadOverlayProps, UploadOverlayState> {
  private fileInput: RefObject<HTMLInputElement>;
  private inputs: InputFields;

  public constructor(props: UploadOverlayProps) {
    super(props);

    this.state = {
      disabled: false,
      // eslint-disable-next-line react/no-unused-state
      inputs: {
        target: this.props.target?.ref(),
        tags: "",
        people: "",
        uploads: proxy({}),
      },
      preview: "",
    };

    this.fileInput = createRef();
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

    let target = this.props.deref(this.inputs.target);
    if (!target) {
      exception(ErrorCode.InvalidState);
    }
    let catalog = target instanceof Catalog ? target : target.catalog;
    let album = target instanceof Catalog ? null : target;

    let strTags = tagsFromString(pending.tags).concat(tagsFromString(this.inputs.tags));
    let strPeople = peopleFromString(pending.people).concat(peopleFromString(this.inputs.people));

    let tagPromises = strTags.map((path: string[]): Promise<Reference<Tag>> =>
      catalog.findTag(path).promise);
    let personPromises = strPeople.map((fullname: string): Promise<Reference<Person>> =>
      catalog.createPerson(fullname).promise);

    let [tags, people] = await Promise.all([
      Promise.all(tagPromises),
      Promise.all(personPromises),
    ]);

    let media: MediaCreateData = {
      catalog: catalog.ref(),
      tags: tags,
      people: people,
      albums: album ? [album.ref()] : [],
      file: pending.file,
    };

    if (pending.orientation) {
      setOrientation(media, pending.orientation);
    }

    try {
      await createMedia(media);

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
      void this.upload(id, pending);
    }
  };

  private async addFile(file: File): Promise<void> {
    let id = uuid();

    let metadata = await parseMetadata(file);
    if (metadata) {
      let upload: PendingUpload = proxy<PendingUpload>({
        file,
        uploading: false,
        failed: false,
        mimetype: metadata.mimetype,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        orientation: metadata.orientation ?? Orientation.TopLeft,
        thumbnailOrientation: metadata.orientation ?? Orientation.TopLeft,
        tags: tagsToString(metadata.tags),
        people: peopleToString(metadata.people),
      });

      if (upload.mimetype === "video/mp4" && upload.orientation && upload.width && upload.height) {
        // Browsers automatically handle the in-file specified translation so
        // by default we don't need to do anything.
        if (upload.orientation !== Orientation.TopLeft) {
          if (areDimensionsFlipped(upload.orientation)) {
            [upload.width, upload.height] = [upload.height, upload.width];
          }
          upload.orientation = Orientation.TopLeft;
          upload.thumbnailOrientation = Orientation.TopLeft;
        }
      }

      if (!metadata.thumbnail || !upload.width || !upload.height) {
        let bitmap = await loadFrame(file, metadata.mimetype, upload.width, upload.height);
        if (bitmap) {
          upload.thumbnail = bitmap;
          if (!upload.height || !upload.width) {
            upload.height = bitmap.height;
            upload.width = bitmap.width;
          } else if (upload.mimetype === "video/mp4" &&
                     areDimensionsFlipped(metadata.orientation || Orientation.TopLeft) &&
                     bitmap.height === upload.width && bitmap.width === upload.height) {
            // Firefox renders the bitmap without applying the correct rotation.
            // So apply it ourselves. See https://bugzilla.mozilla.org/show_bug.cgi?id=1593790.
            upload.thumbnailOrientation = metadata.orientation ?? Orientation.TopLeft;
          }
        }
      }

      if (!upload.thumbnail && metadata.thumbnail) {
        upload.thumbnail = await createImageBitmap(new Blob([metadata.thumbnail]));
      }

      this.inputs.uploads[id] = upload;
    }
  }

  private openFilePicker: (() => void) = (): void => {
    if (this.fileInput.current) {
      this.fileInput.current.click();
    }
  };

  private onNewFiles: (() => void) = (): void => {
    if (this.fileInput.current?.files) {
      this.addFiles(this.fileInput.current.files);
    }
  };

  private addFiles(files: Iterable<File>): void {
    for (let file of files) {
      void this.addFile(file);
    }
  }

  private onUploadClick = (pending: PendingUpload): void => {
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

    if (
      event.dataTransfer.dropEffect === "copy" ||
      event.dataTransfer.dropEffect === "link" ||
      event.dataTransfer.dropEffect === "move"
    ) {
      event.preventDefault();
    }
  };

  private onDragOver = (event: React.DragEvent): void => {
    this.onDragEnter(event);
  };

  private onDrop = (event: React.DragEvent): void => {
    event.preventDefault();

    function isFile(f: File | null): f is File {
      return !!f;
    }

    let files: File[] = Array.from(event.dataTransfer.items)
      .filter(itemIsMedia)
      .map((i: DataTransferItem): File | null => i.getAsFile())
      .filter(isFile);

    this.addFiles(files);
  };

  private onClose = (): void => {
    URL.revokeObjectURL(this.state.preview);
    this.setState({
      selected: undefined,
      preview: "",
    });
  };

  public renderSidebar(): ReactNode {
    if (!this.state.selected) {
      return <Fragment>
        <div className="sidebar-item">
          <Localized id="upload-tree-title"><label className="title"/></Localized>
        </div>
        <MediaTargetSelector property={makeProperty(this.inputs, "target")}/>
        <div id="upload-metadata" className="sidebar-item">
          <FormFields orientation="column">
            <FormField
              id="upload-overlay-global-tags"
              type="textarea"
              labelL10n="upload-global-tags"
              iconName="hashtag"
              disabled={this.state.disabled}
              property={makeProperty(this.inputs, "tags")}
            />
            <FormField
              id="upload-overlay-global-people"
              type="textarea"
              labelL10n="upload-global-people"
              iconName="users"
              disabled={this.state.disabled}
              property={makeProperty(this.inputs, "people")}
            />
          </FormFields>
        </div>
      </Fragment>;
    } else {
      let pending = this.state.selected;
      return <div id="upload-metadata" className="sidebar-item">
        <FormFields orientation="column">
          <FormField
            id="upload-overlay-tags"
            type="textarea"
            labelL10n="upload-media-tags"
            iconName="hashtag"
            disabled={this.state.disabled}
            property={makeProperty(pending, "tags")}
          />
          <FormField
            id="upload-overlay-people"
            type="textarea"
            labelL10n="upload-media-people"
            iconName="users"
            disabled={this.state.disabled}
            property={makeProperty(pending, "people")}
          />
        </FormFields>
      </div>;
    }
  }

  public renderSelected(pending: PendingUpload): ReactNode {
    function rotateLeft(): void {
      pending.orientation = rotateCounterClockwise90(pending.orientation);
      pending.thumbnailOrientation = rotateCounterClockwise90(pending.thumbnailOrientation);
    }

    function rotateRight(): void {
      pending.orientation = rotateClockwise90(pending.orientation);
      pending.thumbnailOrientation = rotateClockwise90(pending.thumbnailOrientation);
    }

    function flipHorizontal(): void {
      pending.orientation = mirrorHorizontal(pending.orientation);
      pending.thumbnailOrientation = mirrorHorizontal(pending.thumbnailOrientation);
    }

    function flipVertical(): void {
      pending.orientation = mirrorVertical(pending.orientation);
      pending.thumbnailOrientation = mirrorVertical(pending.thumbnailOrientation);
    }

    return <div id="selected-upload">
      <Media
        mimetype={pending.mimetype}
        width={pending.width}
        height={pending.height}
        orientation={pending.orientation}
        style={{ height: "100%", width: "100%" }}
        src={this.state.preview}
      />
      <Button
        id="upload-preview-close"
        iconName="times"
        tooltipL10n="upload-preview-close"
        onClick={this.onClose}
      />
      <div id="upload-preview-controls">
        <Button
          id="upload-preview-left"
          iconName="undo"
          tooltipL10n="upload-preview-left"
          onClick={rotateLeft}
        />
        <div id="upload-preview-flip-controls">
          <Button
            id="upload-preview-flip-horizontal"
            iconName="arrows-alt-h"
            tooltipL10n="upload-preview-flip-horizontal"
            onClick={flipHorizontal}
          />
          <Button
            id="upload-preview-flip-vertical"
            iconName="arrows-alt-v"
            tooltipL10n="upload-preview-flip-vertical"
            onClick={flipVertical}
          />
        </div>
        <Button
          id="upload-preview-right"
          iconName="redo"
          tooltipL10n="upload-preview-right"
          onClick={rotateRight}
        />
      </div>
    </div>;
  }

  public render(): ReactNode {
    return <Overlay title="upload-title" sidebar={this.renderSidebar()}>
      <If condition={Object.keys(this.inputs.uploads).length > 0}>
        <Then>
          <div
            className="media-list"
            onDragEnter={this.onDragEnter}
            onDragOver={this.onDragOver}
            onDrop={this.onDrop}
          >
            {
              Object.entries(this.inputs.uploads)
                .map(([id, upload]: [string, PendingUpload]): ReactNode => {
                  return <Upload
                    key={id}
                    upload={upload}
                    onClick={this.onUploadClick}
                  />;
                })
            }
          </div>
        </Then>
        <Else>
          <div
            className="media-list empty"
            onDragEnter={this.onDragEnter}
            onDragOver={this.onDragOver}
            onDrop={this.onDrop}
          >
            <Localized id="upload-drag-media">
              <p/>
            </Localized>
          </div>
        </Else>
      </If>
      <div id="upload-complete">
        <input
          id="fileInput"
          multiple={true}
          accept="image/jpeg,video/mp4"
          type="file"
          ref={this.fileInput}
          onChange={this.onNewFiles}
        />
        <Button l10n="upload-add-files" onClick={this.openFilePicker}/>
        <Button l10n="upload-submit" onClick={this.startUploads}/>
      </div>
      {this.state.selected ? this.renderSelected(this.state.selected) : null}
    </Overlay>;
  }
}

export default connect<PassedProps>()(UploadOverlay, mapStateToProps, mapDispatchToProps);
