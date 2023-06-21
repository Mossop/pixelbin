import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("ui-thumbnailgrid")
export class ThumbnailGrid extends LitElement {
  static styles = [];

  render() {
    return html`
      <link rel="stylesheet" href="/static/css/embedded.css" />

      <div class="d-flex flex-wrap gap-2 px-2 pb-4"><slot></slot></div>
    `;
  }
}
