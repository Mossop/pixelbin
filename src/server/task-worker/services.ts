import type { ExifTool } from "exiftool-vendored";

import { defer, buildServices, serviceProvider } from "../../utils";
import type { DatabaseConnection } from "../database";
import type { StorageService } from "../storage";
import type { RemoteInterface } from "../worker";
import type { ParentProcessInterface } from "./interfaces";

const services = {
  parent: defer<RemoteInterface<ParentProcessInterface>>(),
  storage: defer<StorageService>(),
  exiftool: defer<ExifTool>(),
  database: defer<DatabaseConnection>(),
};

export const provideService = serviceProvider(services);

export default buildServices(services);
