import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ref, createRef } from "lit/directives/ref.js";

@customElement("ui-textfield")
export class TextField extends LitElement {
  static styles = css``;

  inputElement = createRef();

  @property()
  id = "";

  @property()
  label = "Unlabelled";

  @property()
  name = "";

  @property()
  type = "text";

  @property()
  autocomplete = "text";

  get value() {
    return this.inputElement.value?.value ?? "";
  }

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <label for=${this.id} class="form-label">${this.label}</label>
      <input
        ${ref(this.inputElement)}
        name=${this.name}
        type=${this.type}
        autocomplete=${this.autocomplete}
        class="form-control"
        id=${this.id}
      />
    `;
  }
}
