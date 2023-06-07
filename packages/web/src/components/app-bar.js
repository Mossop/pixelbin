import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-bar")
export class AppBar extends LitElement {
  @property()
  title = "";

  static styles = css`
    header {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      color: var(--md-sys-color-on-primary);
      background: var(--md-sys-color-primary);
      padding: calc(2 * var(--spacing));
    }

    #title {
      font-family: "Comfortaa", cursive;
    }
  `;

  render() {
    return html`
      <link rel="stylesheet" href="/static/css/shared.css" />
      <header>
        <h1 id="title" class="title-large">${this.title}</h1>
        <div><slot></slot></div>
      </header>
    `;
  }
}
