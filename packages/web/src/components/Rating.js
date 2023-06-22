import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { bootstrap } from "../modules/styles";

@customElement("ui-rating")
export class Rating extends LitElement {
  static styles = [
    bootstrap,
    css`
      .filled {
        color: rgb(255, 180, 0);
      }
    `,
  ];

  @property({ type: Number })
  rating = 0;

  render() {
    return html`
      <div class="d-flex justify-content-start align-items-center gap-1">
        <ui-icon
          icon="star-fill"
          class=${this.rating >= 1 ? "filled" : "unfilled"}
        ></ui-icon>
        <ui-icon
          icon="star-fill"
          class=${this.rating >= 2 ? "filled" : "unfilled"}
        ></ui-icon>
        <ui-icon
          icon="star-fill"
          class=${this.rating >= 3 ? "filled" : "unfilled"}
        ></ui-icon>
        <ui-icon
          icon="star-fill"
          class=${this.rating >= 4 ? "filled" : "unfilled"}
        ></ui-icon>
        <ui-icon
          icon="star-fill"
          class=${this.rating >= 5 ? "filled" : "unfilled"}
        ></ui-icon>
      </div>
    `;
  }
}
