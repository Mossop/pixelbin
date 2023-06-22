import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import md5 from "md5";

import { logout } from "../modules/api";
import { bootstrap } from "../modules/styles";

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

@customElement("ui-avatar")
export class Avatar extends LitElement {
  static styles = [
    bootstrap,
    css`
      img {
        border-radius: 50%;
        height: 2.5em;
        width: 2.5em;
      }
    `,
  ];

  @property()
  email = "";

  async logout() {
    try {
      await logout();
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  }

  render() {
    let sources = avatarSources(this.email);

    return html`
      <button @click=${this.logout} class="btn shadow-none border-0 m-0 p-0">
        <img src=${sources[0]} srcset=${sources.join(",")} />
      </button>
    `;
  }
}
