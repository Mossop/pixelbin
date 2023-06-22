import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-appbar")
export class AppBar extends LitElement {
  @property()
  title = "";

  static styles = [
    bootstrap,
    css`
      .text-bg-primary {
        --bs-navbar-brand-color: inherit;
        --bs-navbar-brand-hover-color: inherit;
      }

      .navbar-brand {
        font-family: "Comfortaa", cursive;
      }
    `,
  ];

  render() {
    return html`
      <header class="navbar text-bg-primary d-flex p-3 justify-content-between">
        <h1 class="navbar-brand m-0 p-0">${this.title}</h1>
        <div><slot></slot></div>
      </header>
    `;
  }
}
