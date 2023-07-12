import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-thumbnail")
export class Thumbnail extends LitElement {
  static styles = [
    bootstrap,
    css`
      .inner {
        aspect-ratio: 1;
      }

      .overlay {
        opacity: 0.3;
        transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
      }

      :host(:hover) .overlay {
        opacity: 1;
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
      "inner d-block border shadow text-body bg-body rounded-1 p-2 position-relative";

    let content = html`
      <slot></slot>
      <div
        class="overlay position-absolute bottom-0 p-2 start-0 end-0 d-flex flex-row justify-content-between align-items-center"
      >
        <ui-rating rating=${this.rating}></ui-rating>
        <ui-icon icon="image"></ui-icon>
      </div>
    `;

    if (this.href) {
      return html` <a href=${this.href} class=${rootClasses}>${content}</a> `;
    }

    return html` <div class=${rootClasses}>${content}</div> `;
  }
}
