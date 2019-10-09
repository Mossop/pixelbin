import React from "react";

import { StorageConfigUI } from ".";
import TextField from "../components/TextField";

export const BackblazeStorageType = "backblaze";

export interface BackblazeConfig {
  type: typeof BackblazeStorageType;
  keyId: string;
  key: string;
  bucket: string;
  path: string;
}

export class BackblazeConfigUI extends StorageConfigUI {
  public getStorageConfig(): BackblazeConfig {
    return {
      type: BackblazeStorageType,
      keyId: this.getTextState("keyId"),
      key: this.getTextState("key"),
      bucket: this.getTextState("bucket"),
      path: this.getTextState("path"),
    };
  }

  public renderUI(): React.ReactNode {
    return <React.Fragment>
      <TextField uiPath="keyId" required={true} disabled={this.props.disabled}>Application key ID:</TextField>
      <TextField uiPath="key" required={true} disabled={this.props.disabled}>Application key:</TextField>
      <TextField uiPath="bucket" required={true} disabled={this.props.disabled}>Bucket:</TextField>
      <TextField uiPath="path" disabled={this.props.disabled}>Path:</TextField>
    </React.Fragment>;
  }
}
