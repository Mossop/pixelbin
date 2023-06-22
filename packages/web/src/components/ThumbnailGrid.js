import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-thumbnailgrid")
export class ThumbnailGrid extends LitElement {
  static styles = [bootstrap];

  render() {
    return html`
      <div class="d-flex flex-wrap gap-2 px-2 pb-4"><slot></slot></div>
    `;
  }
}
