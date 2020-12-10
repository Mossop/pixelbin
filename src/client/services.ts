import { defer } from "../utils/defer";
import { buildServices, serviceProvider } from "../utils/services";
import type { StoreType } from "./store/types";

const services = {
  store: defer<StoreType>(),
};

export const provideService = serviceProvider(services);

export default buildServices(services);
