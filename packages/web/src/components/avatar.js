import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import md5 from "md5";

/**
 * @param {string} email
 * @returns {string[]}
 */
function avatarSources(email) {
  let hash = md5(email);
  return [
    `https://www.gravatar.com/avatar/${hash}?s=40`,
    `https://www.gravatar.com/avatar/${hash}?s=60 1.5x`,
    `https://www.gravatar.com/avatar/${hash}?s=80 2x`,
  ];
}

@customElement("avatar-button")
export class AvatarButton extends LitElement {
  static styles = css`
    button {
      border: 0;
      padding: 0;
      margin: 0;
      background: transparent;
    }

    img {
      border-radius: 50%;
    }
  `;

  @property()
  email = "";

  render() {
    let sources = avatarSources(this.email);

    return html`
      <link rel="stylesheet" href="/static/css/shared.css" />

      <button>
        <img src=${sources[0]} srcset=${sources.join(",")} />
      </button>
    `;
  }
}
