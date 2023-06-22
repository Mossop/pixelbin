import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrapIcons } from "../modules/styles";

@customElement("ui-icon")
export class Icon extends LitElement {
  static styles = [bootstrapIcons];

  @property()
  icon = "";

  render() {
    return html`<i class="bi-${this.icon}"></i>`;
  }
}
