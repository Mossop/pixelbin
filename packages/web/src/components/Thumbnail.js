import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ui-thumbnail")
export class Thumbnail extends LitElement {
  static styles = [
    css`
      img {
        object-position: center center;
        width: 150px;
        height: 150px;
      }
    `,
  ];

  @property()
  href = "";

  get file() {
    let fileStr = this.getAttribute("file");
    if (!fileStr) {
      return null;
    }
    return JSON.parse(fileStr);
  }

  render() {
    return html`
      <link rel="stylesheet" href="/static/css/embedded.css" />

      <a
        href=${this.href}
        class="d-block shadow-sm text-body bg-body rounded-1"
      >
        <div class="p-2">
          <slot></slot>
        </div>
      </a>
    `;
  }
}
