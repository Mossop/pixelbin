import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-dialog")
export class Dialog extends LitElement {
  static styles = [
    bootstrap,
    css`
      .modal-backdrop {
        display: none;
      }

      .modal-backdrop.active {
        display: block;
      }

      .modal.active {
        display: block;
      }
    `,
  ];

  @state()
  shown = false;

  click(event) {
    if (event.eventPhase != Event.AT_TARGET) {
      return;
    }
    this.close();
  }

  close() {
    this.shown = false;
  }

  transitionEnd() {
    if (!this.shown) {
      this.closed();
    }
  }

  closed() {
    let event = new Event("closed", { bubbles: true, composed: true });
    this.dispatchEvent(event);
  }

  firstUpdated() {
    setTimeout(() => {
      this.shown = true;
      this.querySelector("input[autofocus]")?.focus();
    }, 100);
  }

  render() {
    let classes = ["active"];
    if (this.shown) {
      classes.push("show");
    }

    return html`
      <div
        class="modal-backdrop fade ${classes.join(" ")}"
        @transitionend=${this.transitionEnd}
      ></div>
      <div class="modal fade ${classes.join(" ")}" @click=${this.click}>
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header border-0 py-1 fs-3">
              <slot name="header"></slot>
            </div>
            <div class="modal-body">
              <slot></slot>
            </div>
            <div class="modal-footer border-0">
              <slot name="footer"></slot>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
