import { BackblazeConfig, BackblazeStorageType } from "./types";
import { UIManager } from "../utils/UIState";
import { Field } from "../content/Form";

export function getBackblazeConfigUI(): Field[] {
  return [{
    fieldType: "textbox",
    uiPath: "b2_keyId",
    labelL10n: "storage-backblaze-keyid",
    required: true,
  }, {
    fieldType: "textbox",
    uiPath: "b2_key",
    labelL10n: "storage-backblaze-key",
    required: true,
  }, {
    fieldType: "textbox",
    uiPath: "b2_bucket",
    labelL10n: "storage-backblaze-bucket",
    required: true,
  }, {
    fieldType: "textbox",
    uiPath: "b2_path",
    labelL10n: "storage-backblaze-path",
  }];
}

export function getBackblazeConfig(state: UIManager): BackblazeConfig {
  return {
    type: BackblazeStorageType,
    keyId: state.getTextState("b2_keyId"),
    key: state.getTextState("b2_key"),
    bucket: state.getTextState("b2_bucket"),
    path: state.getTextState("b2_path"),
  };
}
