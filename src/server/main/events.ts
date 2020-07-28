import { EventEmitter } from "events";

import { getLogger } from "../../utils";

const logger = getLogger("server");

const events = new EventEmitter();

export default events;

let quitting = false;
export function quit(): void {
  if (quitting) {
    return;
  }

  quitting = true;
  events.emit("shutdown");

  let quitTimeout = setTimeout((): void => {
    logger.warn("Forcibly quitting main process.");
    process.exit(1);
  }, 5000);

  quitTimeout.unref();
}
