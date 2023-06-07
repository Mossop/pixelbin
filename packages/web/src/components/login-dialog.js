import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { ref, createRef } from "lit/directives/ref.js";

import { login } from "../modules/api";

@customElement("login-dialog")
export class LoginDialog extends LitElement {
  static styles = css``;

  dialogElement = createRef();

  emailInput = createRef();

  passwordInput = createRef();

  render() {
    return html`
      <link rel="stylesheet" href="/static/css/shared.css" />

      <md-dialog
        ${ref(this.dialogElement)}
        fullscreen="true"
        open="true"
        @closed="${this.closed}"
      >
        <p slot="header" class="headline-small">Login</p>
        <form action="#" class="spaced vertical">
          <md-outlined-text-field
            ${ref(this.emailInput)}
            type="email"
            label="Email address"
            ?required=${true}
          ></md-outlined-text-field>
          <md-outlined-text-field
            ${ref(this.passwordInput)}
            type="password"
            label="Password"
            ?required=${true}
          ></md-outlined-text-field>
        </form>
        <div slot="footer" class="spaced horizontal">
          <md-outlined-button @click="${this.cancel}"
            >Cancel</md-outlined-button
          >
          <md-filled-button @click="${this.login}">Login</md-filled-button>
        </div>
      </md-dialog>
    `;
  }

  closed() {
    this.remove();
  }

  cancel() {
    this.dialogElement.value?.close();
  }

  async login() {
    try {
      await login(
        this.emailInput.value?.value,
        this.passwordInput.value?.value,
      );
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  }

  static show() {
    document.body.appendChild(new LoginDialog());
  }
}
