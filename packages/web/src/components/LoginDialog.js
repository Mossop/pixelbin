import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { ref, createRef } from "lit/directives/ref.js";

import { login } from "../modules/api";

@customElement("login-dialog")
export class LoginDialog extends LitElement {
  static styles = css``;

  modalElement = createRef();

  emailInput = createRef();

  passwordInput = createRef();

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <ui-dialog ${ref(this.modalElement)} @closed=${this.closed}>
        <div slot="header">Login</div>
        <form class="d-flex flex-column align-items-stretch gap-3">
          <ui-textfield
            ${ref(this.emailInput)}
            autofocus
            type="email"
            name="email"
            autocomplete="email"
            label="Email Address:"
          ></ui-textfield>
          <ui-textfield
            ${ref(this.passwordInput)}
            type="password"
            name="password"
            autocomplete="password"
            label="Password:"
          ></ui-textfield>
        </form>
        <div
          slot="footer"
          class="d-flex justify-content-end align-items-center gap-3"
        >
          <ui-button color="outline-secondary" @click=${this.cancel}
            >Cancel</ui-button
          >
          <ui-button @click=${this.login}>Login</ui-button>
        </div>
      </ui-dialog>
    `;
  }

  closed() {
    this.remove();
  }

  cancel() {
    this.modalElement.value?.close();
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

window.login = () => {
  LoginDialog.show();
};
