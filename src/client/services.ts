import { defer, buildServices, serviceProvider } from "../utils";
import { StoreType } from "./store/types";

const services = {
  store: defer<StoreType>(),
};

export const provideService = serviceProvider(services);

export default buildServices(services);
