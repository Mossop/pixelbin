import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ui-icon")
export class Icon extends LitElement {
  static styles = [
    css`
      i {
        opacity: 0.54;
      }
    `,
  ];

  @property()
  icon = "";

  render() {
    return html`
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css"
      />

      <i class="bi-${this.icon}"></i>
    `;
  }
}
