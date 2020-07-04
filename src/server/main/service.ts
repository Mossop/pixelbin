import events from "./events";

export abstract class Service {
  protected constructor() {
    events.on("shutdown", (): void => {
      void this.shutdown();
    });
  }

  protected abstract shutdown(): Promise<void>;
}
