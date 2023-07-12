import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

/**
 * @param {string} target
 * @param {string} source
 * @returns {boolean}
 */
function isURLPrefix(target, source) {
  if (target == source) {
    return true;
  }

  if (!source.startsWith(target)) {
    return false;
  }

  let next = source.charAt(target.length);
  return ["/", "?", "#"].includes(next);
}

@customElement("ui-iconlist")
export class IconList extends LitElement {
  static styles = [
    bootstrap,
    css`
      ul,
      ol {
        list-style-type: none;
      }
    `,
  ];

  render() {
    return html`
      <ul class="p-0 m-0">
        <slot></slot>
      </ul>
    `;
  }
}

@customElement("ui-iconlistitem")
export class IconListItem extends LitElement {
  static styles = [
    bootstrap,
    css`
      a {
        text-decoration: none;
        color: inherit;
      }

      ui-icon {
        font-size: 120%;
      }

      .item-label {
        padding-inline-start: calc(var(--list-item-depth) * 1rem + 0.25rem);
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: start;
        padding-inline-end: 0.25rem;
        padding-top: 0.25em;
        padding-bottom: 0.25em;
      }

      a.item-label:hover,
      a.item-label.selected {
        background-color: var(--bs-secondary-bg-subtle);
      }

      .label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .count {
        min-width: 3em;
        text-align: right;
      }
    `,
  ];

  @property({ type: Number })
  count = 0;

  @property()
  href = "";

  @property()
  label = "";

  @property()
  icon = "";

  render() {
    if (this.href) {
      let target = new URL(this.href, document.documentURI).toString();
      let selected = isURLPrefix(target, document.documentURI);

      return html`
        <li>
          <a class="item-label ${selected ? "selected" : ""}" href=${this.href}>
            <ui-icon class="pe-2" icon=${this.icon}></ui-icon>
            <span class="label">${this.label}</span>
            <span class="count">${this.count === 0 ? "" : this.count}</span>
          </a>
          <div>
            <slot></slot>
          </div>
        </li>
      `;
    }

    return html`
      <li>
        <div class="item-label">
          <ui-icon class="pe-2" icon=${this.icon}></ui-icon>
          <span class="label">${this.label}</span>
          <span class="count">${this.count === 0 ? "" : this.count}</span>
        </div>
        <div>
          <slot></slot>
        </div>
      </li>
    `;
  }
}
