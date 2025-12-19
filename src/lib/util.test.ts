import { expect, test } from "vitest";
import { range } from "./util";

test("Range", () => {
  const array = [];
  for (const i of range(2, 10, 2)) {
    array.push(i);
  }
  expect(array).toStrictEqual([2, 4, 6, 8]);
});
