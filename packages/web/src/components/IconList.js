import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("ui-iconlist")
export class IconList extends LitElement {
  static styles = [
    css`
      ul,
      ol {
        list-style-type: none;
      }
    `,
  ];

  render() {
    return html`
      <link rel="stylesheet" href="/static/css/embedded.css" />

      <ul class="p-0 m-0">
        <slot></slot>
      </ul>
    `;
  }
}

@customElement("ui-iconlistitem")
export class IconListItem extends LitElement {
  static styles = [
    css`
      a {
        text-decoration: none;
        color: inherit;
      }
    `,
  ];

  @property()
  href = "";

  @property()
  label = "";

  @property()
  icon = "";

  render() {
    if (this.href) {
      return html`
        <link rel="stylesheet" href="/static/css/embedded.css" />

        <li>
          <a class="d-flex flex-row align-items-center pb-1" href=${this.href}
            ><ui-icon class="pe-2" icon=${this.icon}></ui-icon>${this.label}</a
          >
          <div class="ps-3">
            <slot></slot>
          </div>
        </li>
      `;
    }

    return html`
      <link rel="stylesheet" href="/static/css/embedded.css" />

      <li>
        <div class="d-flex flex-row align-items-center pb-1">
          <ui-icon class="pe-2" icon=${this.icon}></ui-icon>${this.label}
        </div>
        <div class="ps-3">
          <slot></slot>
        </div>
      </li>
    `;
  }
}
