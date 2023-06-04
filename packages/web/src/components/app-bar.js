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
      color: var(--accent-color);
      background: var(--accent-background);
      padding: calc(2 * var(--padding));
    }

    h1 {
      font-size: 1.5rem;
      font-family: "Comfortaa", cursive;
      font-weight: bold;
      margin: 0;
    }
  `;

  render() {
    return html`<header>
      <h1>${this.title}</h1>
      <div><slot></slot></div>
    </header>`;
  }
}
