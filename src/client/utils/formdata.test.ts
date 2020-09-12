import { expect } from "../../test-helpers";
import { formParams } from "./formdata";

test("formparams", (): void => {
  let blob1 = new Blob();
  let blob2 = new Blob();

  expect([...formParams({
    a: 5,
    b: [
      1,
      2,
      3,
      "baz",
      blob2,
      [4, 5, 6],
    ],
    c: [{
      d: 6,
      e: 7,
      f: "foobar",
    }, {
      d: {
        t: "s",
      },
    }],
    ref: [
      "1",
      "2",
    ],
    blb: blob1,
  })]).toInclude([
    ["a", "5"],
    ["b[0]", "1"],
    ["b[1]", "2"],
    ["b[2]", "3"],
    ["b[3]", "baz"],
    ["b[4]", blob2],
    ["b[5][0]", "4"],
    ["b[5][1]", "5"],
    ["b[5][2]", "6"],
    ["c[0].d", "6"],
    ["c[0].e", "7"],
    ["c[0].f", "foobar"],
    ["c[1].d.t", "s"],
    ["ref[0]", "1"],
    ["ref[1]", "2"],
    ["blb", blob1],
  ]);

  expect([...formParams([1, 2, 3, blob1])]).toInclude([
    ["[0]", "1"],
    ["[1]", "2"],
    ["[2]", "3"],
    ["[3]", blob1],
  ]);
});
