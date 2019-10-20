import React from "react";
import { Metadata, Orientation } from "media-metadata/lib/metadata";
import path from "path";

import ImageCanvas from "../components/ImageCanvas";
import { parseMetadata, loadPreview } from "../utils/metadata";

interface UploadProps {
  file: File;
}

interface UploadState {
  error: boolean;
  title: string;
  tags: string[][];
  people: string[];
  orientation: Orientation;
  thumbnail?: ImageBitmap;
  preview?: ImageBitmap;
}

export default class Upload extends React.Component<UploadProps, UploadState> {
  public constructor(props: UploadProps) {
    super(props);

    this.state = {
      error: false,
      title: path.basename(props.file.name, path.extname(props.file.name)),
      tags: [],
      people: [],
      orientation: Orientation.Normal,
    };

    parseMetadata(props.file).then((metadata: Metadata | null) => {
      if (metadata) {
        if (metadata.thumbnail) {
          let blob = new Blob([metadata.thumbnail]);
          createImageBitmap(blob).then((thumbnail: ImageBitmap) => {
            this.setState({ thumbnail });
          });
        }

        this.setState({
          orientation: metadata.orientation,
          tags: metadata.tags,
          people: metadata.people,
        });

        if (metadata.title) {
          this.setState({ title: metadata.title });
        }
      } else {
        this.setState({ error: true });
      }
    });

    loadPreview(props.file, props.file.type).then((thumbnail: ImageBitmap | null) => {
      if (thumbnail) {
        this.setState({ preview: thumbnail });
      } else {
        this.setState({ error: true });
      }
    });
  }

  public get title(): string {
    return this.state.title;
  }

  public get tags(): string[][] {
    return this.state.tags;
  }

  public get people(): string[] {
    return this.state.people;
  }

  public get orientation(): Orientation {
    return this.state.orientation;
  }

  public renderThumbnail(): React.ReactNode {
    let image = this.state.thumbnail || this.state.preview;
    if (image) {
      return <ImageCanvas bitmap={image} size={150} className="thumbnail"/>;
    } else {
      return <div className="image-processing thumbnail" style={{ width: "150px", height: "150px" }}/>;
    }
  }

  public render(): React.ReactNode {
    return <div className="media">
      {this.renderThumbnail()}
      <p className="title">{this.state.title}</p>
    </div>;
  }
}
