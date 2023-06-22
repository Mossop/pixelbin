import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-button")
export class Button extends LitElement {
  static styles = [bootstrap];

  @property()
  color = "primary";

  render() {
    return html`
      <button class="btn btn-${this.color}">
        <slot></slot>
      </button>
    `;
  }
}
