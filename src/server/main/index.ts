#!/usr/bin/env node
import { install } from "source-map-support";

import cli from "./cli";

install();

cli(process.argv.slice(2));
