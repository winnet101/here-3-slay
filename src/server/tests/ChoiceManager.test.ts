import { expect, expectTypeOf, test } from "vitest";
import ChoiceManager from "../ChoiceManager";

type Choices = { cards: string; target: number; confirm: boolean };

test("validates each choice independently and waits for every response", async () => {
  const manager = new ChoiceManager<Choices>();
  const result = manager.setChoices([
    { choice: "cards", validValues: ["a", "b", "c"], numberOfValues: 2 },
    { choice: "target", validValues: [1, 2] },
  ]);
  expectTypeOf(result).toEqualTypeOf<Promise<{ cards: string[]; target: number[] }>>();
  let resolved = false;
  void result.then(() => { resolved = true; });

  expect(manager.resolveChoice("confirm", [true]).kind).toBe("err");
  expect(manager.resolveChoice("target", [3]).kind).toBe("err");
  expect(manager.resolveChoice("target", [2]).kind).toBe("ok");
  expect(manager.resolveChoice("target", [1]).kind).toBe("err");
  expect(manager.resolveChoice("cards", ["a"]).kind).toBe("err");
  expect(manager.resolveChoice("cards", ["a", "invalid"]).kind).toBe("err");
  await Promise.resolve();
  expect(resolved).toBe(false);

  expect(manager.resolveChoice("cards", ["a", "b"]).kind).toBe("ok");
  await expect(result).resolves.toEqual({ cards: ["a", "b"], target: [2] });
  expect(manager.currentChoices).toEqual([]);
  expect(manager.resolveChoice("cards", ["a", "b"]).kind).toBe("err");
});

test("requires input even when a batch choice has only one allowed value", async () => {
  const manager = new ChoiceManager<Choices>();
  const result = manager.setChoices([
    { choice: "confirm", validValues: [true] },
    { choice: "target" },
  ]);
  manager.resolveChoice("target", [42]);
  let resolved = false;
  void result.then(() => { resolved = true; });
  await Promise.resolve();
  expect(resolved).toBe(false);
  manager.resolveChoice("confirm", [true]);
  await expect(result).resolves.toEqual({ confirm: [true], target: [42] });
});

test("snapshots allowed values and accepted responses", async () => {
  const manager = new ChoiceManager<Choices>();
  const allowed = ["a", "b"];
  const result = manager.setChoices([
    { choice: "cards", validValues: allowed },
    { choice: "target" },
  ]);
  allowed.push("c");
  expect(manager.resolveChoice("cards", ["c"]).kind).toBe("err");
  const response = ["a"];
  manager.resolveChoice("cards", response);
  response[0] = "c";
  manager.resolveChoice("target", [1]);
  await expect(result).resolves.toEqual({ cards: ["a"], target: [1] });
});

test("rejects overlapping requests without losing the active batch", async () => {
  const manager = new ChoiceManager<Choices>();
  const result = manager.setChoices([{ choice: "cards" }]);
  await expect(manager.setChoices([{ choice: "target" }])).rejects.toThrow("active choices");
  await expect(manager.setChoice("cards", ["forced"])).rejects.toThrow("active choices");
  manager.resolveChoice("cards", ["a"]);
  await expect(result).resolves.toEqual({ cards: ["a"] });
});

test("rejects duplicate names and invalid counts before starting a batch", async () => {
  const manager = new ChoiceManager<Choices>();
  await expect(manager.setChoices([{ choice: "cards" }, { choice: "cards" }])).rejects.toThrow("Duplicate");
  for (const numberOfValues of [-1, 1.5, NaN, Infinity]) {
    await expect(manager.setChoices([{ choice: "cards", numberOfValues }])).rejects.toThrow("numberOfValues");
    await expect(manager.setChoice("cards", [], numberOfValues)).rejects.toThrow("numberOfValues");
  }
  expect(manager.currentChoices).toEqual([]);
  await expect(manager.setChoices([])).resolves.toEqual({});
});

test("supports zero-value responses and an empty allowed list", async () => {
  const manager = new ChoiceManager<Choices>();
  const result = manager.setChoices([
    { choice: "cards", validValues: [], numberOfValues: 0 },
    { choice: "target", validValues: [] },
  ]);
  expect(manager.resolveChoice("cards", []).kind).toBe("ok");
  expect(manager.resolveChoice("target", [1]).kind).toBe("err");
  // An impossible choice must never complete the batch.
  let resolved = false;
  void result.then(() => { resolved = true; });
  await Promise.resolve();
  expect(resolved).toBe(false);
});

test("preserves single-choice results and forced selections without stale state", async () => {
  const manager = new ChoiceManager<Choices>();
  const result = manager.setChoice("target", [1, 2]);
  expectTypeOf(result).toEqualTypeOf<Promise<number[]>>();
  manager.resolveChoice("target", [2]);
  await expect(result).resolves.toEqual([2]);
  await expect(manager.setChoice("cards", ["a"], 2)).resolves.toEqual(["a"]);
  await expect(manager.setChoice("cards", [])).resolves.toEqual([]);
  expect(manager.currentChoices).toEqual([]);
  expect(manager.resolveChoice("cards", [])).toMatchObject({ kind: "err" });
});

test("choice names constrain allowed values and responses at compile time", () => {
  const manager = new ChoiceManager<Choices>();
  // Kept unreachable: tsc checks these invalid API calls without executing them.
  if (false) {
    // @ts-expect-error Unknown choice name.
    manager.setChoices([{ choice: "missing" }]);
    // @ts-expect-error Cards require string values.
    manager.setChoices([{ choice: "cards", validValues: [1] }]);
    // @ts-expect-error Target requires number values.
    manager.resolveChoice("target", ["a"]);
    // @ts-expect-error Confirm requires boolean values.
    manager.setChoice("confirm", [1]);
  }
});
