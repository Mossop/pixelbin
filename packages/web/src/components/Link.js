import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-link")
export class Link extends LitElement {
  static styles = [bootstrap];

  @property()
  href = "";

  @property({ type: Boolean })
  replace = false;

  onClick(event) {
    if (this.replace) {
      let target = new URL(this.href, document.documentURI).toString();
      window.location.replace(target);
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
