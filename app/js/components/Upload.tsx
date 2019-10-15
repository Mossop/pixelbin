import React from "react";
import { Metadata } from "media-metadata/lib/metadata";
import ImageCanvas from "../content/ImageCanvas";
import { parseMetadata, createThumbnail } from "../utils/metadata";

interface UploadProps {
  file: File;
}

interface UploadState {
  error: boolean;
  metadata?: Metadata;
  thumbnail?: ImageBitmap;
}

export default class Upload extends React.Component<UploadProps, UploadState> {
  public constructor(props: UploadProps) {
    super(props);

    this.state = {
      error: false,
    };

    parseMetadata(props.file).then(async (metadata: Metadata| null) => {
      if (metadata) {
        if (metadata.thumbnail) {
          console.log("Found embedded thumbnail");
          let blob = new Blob([metadata.thumbnail]);
          let thumbnail = await createImageBitmap(blob);
          if (!this.state.thumbnail) {
            console.log("Added embedded thumbnail");
            this.setState({ thumbnail });
          }
        }

        this.setState({ metadata });
      } else {
        this.setState({ error: true });
      }
    });

    createThumbnail(props.file, props.file.type).then((thumbnail: ImageBitmap | null) => {
      if (thumbnail) {
        console.log("Loaded thumbnail.");
        this.setState({ thumbnail });
      } else {
        this.setState({ error: true });
      }
    });
  }

  public renderThumbnail(): React.ReactNode {
    if (this.state.thumbnail) {
      return <ImageCanvas bitmap={this.state.thumbnail} size={150}/>;
    } else {
      return null;
    }
  }

  public render(): React.ReactNode {
    return <div className="media">
      {this.renderThumbnail()}
    </div>;
  }
}
