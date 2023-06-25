import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-thumbnailgrid")
export class ThumbnailGrid extends LitElement {
  static styles = [
    bootstrap,
    css`
      div {
        grid-template-columns: repeat(
          auto-fill,
          minmax(calc(150px + 1rem), 1fr)
        );
      }
    `,
  ];

  render() {
    return html`
      <div class="d-grid gap-2 px-2 pb-4">
        <slot></slot>
      </div>
    `;
  }
}
