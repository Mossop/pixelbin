import { window } from "../environment";

export default class Delayed {
  private timer: number | undefined;

  public constructor(public readonly timeout: number, private callback: () => void) {
  }

  public trigger(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(this.callback, this.timeout);
  }

  public cancel(): void {
    window.clearTimeout(this.timer);
  }
}
