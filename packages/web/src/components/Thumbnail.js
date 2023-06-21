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

  @property({ type: Number })
  rating = 0;

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
    let rootClasses =
      "d-block border shadow text-body bg-body rounded-1 p-2 position-relative";

    let content = html`
      <slot></slot>
      <div
        class="position-absolute bottom-0 p-2 start-0 end-0 d-flex flex-row justify-content-between align-items-center"
      >
        <ui-rating rating=${this.rating}></ui-rating>
        <ui-icon icon="image"></ui-icon>
      </div>
    `;

    if (this.href) {
      return html`
        <link rel="stylesheet" href="/static/css/embedded.css" />

        <a href=${this.href} class=${rootClasses}>${content}</a>
      `;
    }

    return html`
      <link rel="stylesheet" href="/static/css/embedded.css" />

      <div class=${rootClasses}>${content}</div>
    `;
  }
}
