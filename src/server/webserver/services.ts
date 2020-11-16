import type http from "http";

import { defer, buildServices, serviceProvider } from "../../utils";
import type { Cache } from "../cache";
import type { DatabaseConnection } from "../database";
import type { StorageService } from "../storage";
import type { RemoteInterface } from "../worker";
import type { ParentProcessInterface } from "./interfaces";

const services = {
  parent: defer<RemoteInterface<ParentProcessInterface>>(),
  storage: defer<StorageService>(),
  database: defer<DatabaseConnection>(),
  cache: defer<Cache>(),
  server: defer<http.Server>(),
};

export const provideService = serviceProvider(services);

export default buildServices(services);
