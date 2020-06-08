/* eslint-disable @typescript-eslint/no-var-requires */
import cluster from "cluster";

function main(): void {
  let processMain: () => void;

  if (cluster.isMaster) {
    console.log(process.pid, "Starting master.");
    processMain = require("./master").default;
  } else {
    let spec = process.env["CHILD_MODULE"];
    if (spec) {
      console.log(process.pid, `Starting ${spec} worker.`);
      processMain = require(`./${spec}`).default;
    } else {
      throw new Error("No module provided to child process.");
    }
  }

  processMain();
}

main();
