import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-bar")
export class AppBar extends LitElement {
  @property()
  title = "";

  render() {
    return html`<header>${this.title}</header>`;
  }
}
