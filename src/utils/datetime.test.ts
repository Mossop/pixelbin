import { LocalZone } from "luxon";

import { expect } from "../test-helpers";
import { hasTimezone, isoDateTime, parseDateTime } from "./datetime";

test("parse and output", () => {
  let parsed = parseDateTime("2020-05-06T17:01:02");
  expect(parsed).toEqualDate("2020-05-06T17:01:02");
  expect(parsed.hour).toBe(17);
  expect(parsed.offset).toBe(new LocalZone().offset(parsed.toMillis()));
  expect(isoDateTime(parsed)).toBe("2020-05-06T17:01:02.000");
  expect(hasTimezone(parsed)).toBeFalsy();

  parsed = parseDateTime("2020-05-06T17:01:02Z");
  expect(parsed).toEqualDate("2020-05-06T17:01:02Z");
  expect(parsed.hour).toBe(17);
  expect(parsed.offset).toBe(0);
  expect(isoDateTime(parsed)).toBe("2020-05-06T17:01:02.000Z");
  expect(hasTimezone(parsed)).toBeTruthy();

  parsed = parseDateTime("2020-05-06T17:01:02-07:00");
  expect(parsed).toEqualDate("2020-05-07T00:01:02Z");
  expect(parsed.hour).toBe(17);
  expect(parsed.offset).toBe(-420);
  expect(isoDateTime(parsed)).toBe("2020-05-06T17:01:02.000-07:00");
  expect(hasTimezone(parsed)).toBeTruthy();
});
