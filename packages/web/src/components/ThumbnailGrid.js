import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

let gridCss = [];
for (let i = 2; i < 20; i++) {
  gridCss.push(`
    @container (width > calc(0.5rem + ${i} * calc(150px + 1.5rem))) {
      div {
        grid-template-columns: repeat(${i}, 1fr);
      }
    }
  `);
}

@customElement("ui-thumbnailgrid")
export class ThumbnailGrid extends LitElement {
  static styles = [
    bootstrap,
    css`
      :host {
        container-type: inline-size;
        display: block;
      }

      div {
        grid-template-columns: repeat(1, 1fr);
      }
    `,
    unsafeCSS(gridCss.join("\n")),
  ];

  render() {
    return html`
      <div class="d-grid gap-2 px-2 pb-4">
        <slot></slot>
      </div>
    `;
  }
}
