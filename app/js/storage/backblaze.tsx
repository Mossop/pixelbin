import React from "react";

import { StorageConfigUI, BackblazeConfig, BackblazeStorageType } from "./types";
import Textbox from "../components/Textbox";
import FieldLabel from "../components/FieldLabel";

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
      <FieldLabel l10n="storage-backblaze-keyid" for="keyId"/>
      <Textbox id="keyId" uiPath="keyId" required={true} disabled={this.props.disabled}/>
      <FieldLabel l10n="storage-backblaze-key" for="key"/>
      <Textbox id="key" uiPath="key" required={true} disabled={this.props.disabled}/>
      <FieldLabel l10n="storage-backblaze-bucket" for="bucket"/>
      <Textbox id="bucket" uiPath="bucket" required={true} disabled={this.props.disabled}/>
      <FieldLabel l10n="storage-backblaze-path" for="path"/>
      <Textbox id="path" uiPath="path" disabled={this.props.disabled}/>
    </React.Fragment>;
  }
}
