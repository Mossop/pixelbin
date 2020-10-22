import { defer } from "./defer";
import { serviceProvider, buildServices } from "./services";

test("Services", async (): Promise<void> => {
  const serviceMap = {
    known: 5,
    base: defer<number>(),
    other: jest.fn(() => {
      return 8;
    }),
    intermediate: jest.fn(async (): Promise<number> => {
      let value = await services.base;
      return value + 7;
    }),
    final: jest.fn(async (): Promise<number> => {
      let inter = await services.intermediate;
      let other = await services.other;
      return inter + other;
    }),
  };

  const services = buildServices(serviceMap);
  const provider = serviceProvider(serviceMap);

  let value = await services.known;
  expect(value).toBe(5);

  expect(serviceMap.other).not.toHaveBeenCalled();
  expect(serviceMap.intermediate).not.toHaveBeenCalled();
  expect(serviceMap.final).not.toHaveBeenCalled();

  let promise = services.final;
  expect("then" in promise).toBeTruthy();
  expect(serviceMap.other).not.toHaveBeenCalled();
  expect(serviceMap.final).toHaveBeenCalledTimes(1);
  expect(serviceMap.intermediate).toHaveBeenCalledTimes(1);

  provider("base", 2);

  value = await promise;
  expect(value).toBe(17);
  expect(serviceMap.other).toHaveBeenCalledTimes(1);
  expect(serviceMap.intermediate).toHaveBeenCalledTimes(1);
  expect(serviceMap.final).toHaveBeenCalledTimes(1);

  value = await services.final;
  expect(value).toBe(17);
  expect(serviceMap.other).toHaveBeenCalledTimes(1);
  expect(serviceMap.intermediate).toHaveBeenCalledTimes(1);
  expect(serviceMap.final).toHaveBeenCalledTimes(1);
});
