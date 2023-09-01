import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-back")
export class Back extends LitElement {
  static styles = [bootstrap];

  @property()
  href = "";

  onClick(event) {
    let target = new URL(this.href, document.documentURI).toString();
    if (target == document.referrer) {
      window.history.back();
      event.preventDefault();
    }
  }

  render() {
    return html`
      <a href=${this.href} @click=${this.onClick}>
        <slot></slot>
      </a>
    `;
  }
}
