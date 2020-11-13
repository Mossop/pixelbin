import events, { quit } from "./events";

jest.useFakeTimers();
// @ts-ignore
const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
  // no-op
});

test("quit", () => {
  let quitted = jest.fn();
  events.on("shutdown", quitted);

  quit();

  expect(mockExit).not.toHaveBeenCalled();
  expect(quitted).toHaveBeenCalledTimes(1);

  jest.runAllTimers();
  expect(mockExit).toHaveBeenCalledTimes(1);
  expect(mockExit).toHaveBeenLastCalledWith(1);
});
