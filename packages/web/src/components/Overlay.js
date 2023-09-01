import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { bootstrap } from "../modules/styles";

@customElement("ui-overlay")
export class Overlay extends LitElement {
  static styles = [
    bootstrap,
    css`
      .overlay-inner {
        height: 100%;
        width: 100%;
        transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
      }

      .overlay-inner.overlay-hidden {
        display: none;
        opacity: 0;
      }

      .overlay-inner.overlay-pending {
        opacity: 0;
      }

      .overlay-inner.overlay-showing {
        opacity: 1;
      }

      .overlay-inner.overlay-shown {
        opacity: 1;
      }

      .overlay-inner.overlay-hiding {
        opacity: 0;
      }
    `,
  ];

  timeout = null;

  constructor() {
    super();

    this.addEventListener("mousemove", () => this.onMouseMove());
    this.setTimeout();
    this.state = "shown";
  }

  @state()
  state = "shown";

  setTimeout() {
    this.timeout = window.setTimeout(() => {
      this.timeout = null;
      this.onTimeout();
    }, 5000);
  }

  clearTimeout() {
    if (this.timeout !== null) {
      window.clearTimeout(this.timeout);
    }
    this.timeout = null;
  }

  onTimeout() {
    this.hide();
  }

  onMouseMove() {
    this.display();
    this.clearTimeout();
    this.setTimeout();
  }

  onTransitionEnd() {
    if (this.state == "showing") {
      this.state = "shown";
    } else if (this.state == "hiding") {
      this.state = "hidden";
    }
  }

  display() {
    switch (this.state) {
      case "hidden":
        this.state = "pending";
        window.setTimeout(() => {
          if (this.state == "pending") {
            this.state = "showing";
          }
        }, 100);
        break;
      case "hiding":
        this.state = "showing";
        break;
      default:
      // Nothing to do.
    }
  }

  hide() {
    switch (this.state) {
      case "shown":
      case "showing":
        this.state = "hiding";
        break;
      default:
      // Nothing to do.
    }
  }

  render() {
    return html`
      <div
        @transitionend=${this.onTransitionEnd}
        class="overlay-inner overlay-${this.state}"
      >
        <slot></slot>
      </div>
    `;
  }
}
