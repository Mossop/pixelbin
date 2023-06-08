import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ui-button")
export class Button extends LitElement {
  static styles = css``;

  @property()
  color = "primary";

  render() {
    return html`
      <link rel="stylesheet" href="/static/css/embedded.css" />

      <button class="btn btn-${this.color}">
        <slot></slot>
      </button>
    `;
  }
}
