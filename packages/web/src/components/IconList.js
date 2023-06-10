import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

import styles from "../modules/styles";

@customElement("ui-iconlist")
export class IconList extends LitElement {
  static styles = [
    styles,
    css`
      ul,
      ol {
        list-style-type: none;
      }
    `,
  ];

  render() {
    return html`
      <ul class="ps-3 m-0">
        <slot></slot>
      </ul>
    `;
  }
}

@customElement("ui-iconlistitem")
export class IconListItem extends LitElement {
  static styles = [styles, css``];

  @property()
  label = "";

  @property()
  icon = "";

  render() {
    return html`<li>
      <div class="d-flex flex-row align-items-center pb-1">
        <ui-icon class="pe-2" icon=${this.icon}></ui-icon>${this.label}
      </div>
      <slot></slot>
    </li>`;
  }
}
