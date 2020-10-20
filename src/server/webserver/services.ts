import { defer, buildServices, serviceProvider } from "../../utils";
import { Cache } from "../cache";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { RemoteInterface } from "../worker";
import { ParentProcessInterface } from "./interfaces";

const services = {
  parent: defer<RemoteInterface<ParentProcessInterface>>(),
  storage: defer<StorageService>(),
  database: defer<DatabaseConnection>(),
  cache: defer<Cache>(),
};

export const provideService = serviceProvider(services);

export default buildServices(services);
