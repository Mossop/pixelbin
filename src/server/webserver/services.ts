import { defer, buildServices, serviceProvider } from "../../utils";
import { RemoteInterface } from "../../worker";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { ParentProcessInterface } from "./interfaces";

const services = {
  parent: defer<RemoteInterface<ParentProcessInterface>>(),
  storage: defer<StorageService>(),
  database: defer<DatabaseConnection>(),
};

export const provideService = serviceProvider(services);

export default buildServices(services);