import { Deferred } from "./defer";
import { entries } from "./utility";

type ServiceType<SM, S extends keyof SM> = SM[S] extends Deferred<infer T> ? T : never;

type Services<SM> = {
  [S in keyof SM]: Promise<ServiceType<SM, S>>;
};

export function buildServices<SM>(map: SM): Services<SM> {
  return Object.fromEntries(
    entries(map).map(
      <S extends keyof SM>(
        [key, value]: [S, SM[S]],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      ): [S, Promise<ServiceType<SM, S>>] => [key, value["promise"]],
    ),
  ) as unknown as Services<SM>;
}

type ServiceResolution<SM, S extends keyof SM> = ServiceType<SM, S> | Promise<ServiceType<SM, S>>;
export function serviceProvider<SM>(
  map: SM,
): <S extends keyof SM>(service: S, value: ServiceResolution<SM, S>) => void {
  return <S extends keyof SM>(service: S, value: ServiceResolution<SM, S>): void => {
    // @ts-ignore: The properties of SM cannot be defined.
    map[service].resolve(value);
  };
}