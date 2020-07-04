import { Logger } from "../../utils";
import events from "./events";

export abstract class Service {
  protected constructor(protected readonly logger: Logger) {
    events.on("shutdown", (): void => {
      this.logger.catch(this.shutdown());
    });
  }

  protected abstract shutdown(): Promise<void>;
}
