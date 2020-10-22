/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Deferred } from "./defer";

type ServiceType<S> =
  S extends Deferred<infer T>
    ? T
    : S extends () => Promise<infer T>
      ? T
      : S extends () => infer T
        ? T
        : S extends Promise<infer T>
          ? T
          : S;

type Services<SM> = {
  [S in keyof SM]: Promise<ServiceType<SM[S]>>;
};

export function buildServices<SM>(map: SM): Services<SM> {
  const resolveService = <S extends keyof SM>(key: S): Promise<ServiceType<SM[S]>> => {
    if (typeof map[key] == "function") {
      try {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return Promise.resolve(map[key]());
      } catch (e) {
        return Promise.reject(e);
      }
    }

    if (typeof map[key] == "object" && "promise" in map[key]) {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return map[key].promise;
    }

    // @ts-ignore
    return Promise.resolve(map[key]);
  };

  let registry: Partial<Services<SM>> = {};
  return new Proxy<Services<SM>>(registry as Services<SM>, {
    get<S extends keyof SM>(target: Services<SM>, property: S): Promise<ServiceType<SM[S]>> {
      if (!(property in registry)) {
        registry[property] = resolveService(property);
      }

      // @ts-ignore
      return registry[property];
    },
  });
}

type DeferredServices<SM> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof SM]: SM[K] extends Deferred<any> ? K : never;
}[keyof SM];

type ServiceResolution<SM, S extends keyof SM> = ServiceType<SM[S]> | Promise<ServiceType<SM[S]>>;
export function serviceProvider<SM>(
  map: SM,
): <S extends DeferredServices<SM>>(service: S, value: ServiceResolution<SM, S>) => void {
  return <S extends keyof SM>(service: S, value: ServiceResolution<SM, S>): void => {
    // @ts-ignore: The properties of SM cannot be defined.
    map[service].resolve(value);
  };
}
