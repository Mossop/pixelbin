#!/usr/bin/env node
import { install } from "source-map-support";

import { getLogger, NDJsonTransport } from "../../utils";
import cli from "./cli";

install();

const logger = getLogger();
logger.name = "main";
logger.config.transport = new NDJsonTransport(process.stdout);

cli(process.argv.slice(2));
