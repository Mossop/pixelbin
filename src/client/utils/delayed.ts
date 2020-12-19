import { window } from "../environment";

export default class Delayed {
  private timer: number | undefined;
  private nextTime: number | undefined;

  public constructor(
    private triggerCallback: () => void,
    private delayedCallback: () => void,
    private timeout: number,
  ) {
  }

  private startTimer(nextTime: number): void {
    this.stopTimer();

    let delay = nextTime - Date.now();
    if (delay > 0) {
      this.timer = window.setTimeout(() => {
        this.timer = undefined;
        this.nextTime = undefined;
        this.delayedCallback();
      }, delay);
    } else {
      this.nextTime = undefined;
      this.delayedCallback();
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  public trigger(): void {
    if (!this.timer) {
      this.triggerCallback();
    }

    this.startTimer(Date.now() + this.timeout);
  }

  public pause(): void {
    this.stopTimer();
  }

  public resume(timeout: number): void {
    if (this.timeout != timeout) {
      if (this.nextTime) {
        this.nextTime += timeout - this.timeout;
      }
      this.timeout = timeout;
    }

    if (this.nextTime) {
      this.startTimer(this.nextTime);
    }
  }
}
