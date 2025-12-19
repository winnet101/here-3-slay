import GameEngine from "../GameEngine";
import { expect, test } from "vitest";

const gameEngine = new GameEngine<
  {},
  { id: string },
  {
    number: number;
  }
>(
  {
    players: [{ id: "player1" }, { id: "player2" }],
  },
  () => true
);

test("getChoice", async () => {
  const choice = gameEngine.makeChoices("number", ["player1", "player2"]);
  setTimeout(() => {
    gameEngine.resolveChoice("player1", 42);
    gameEngine.resolveChoice("player2", 7);
  }, 100);

  const results = await choice;
  expect(results).toEqual([
    ["player1", 42],
    ["player2", 7],
  ]);
});

test("raceChoice", async () => {
  const choice = gameEngine.raceChoice("number", ["player1", "player2"]);
  setTimeout(() => {
    gameEngine.resolveChoice("player2", 7);
    gameEngine.resolveChoice("player1", 42);
  }, 100);

  const [id, result] = await choice;
  expect(id).toEqual("player2");
  expect(result).toEqual(7);
});

test("timeout", async () => {
  gameEngine.defaultTimeoutMs = 100;
  const choice = gameEngine.makeChoices("number", ["player1", "player2"]);
  setTimeout(() => {
    gameEngine.resolveChoice("player1", 42);
  }, 50);

  const [[id1, res1], [id2, res2]] = await choice;
  expect(id1).toEqual("player1");
  expect(res1).toEqual(42);

  expect(id2).toEqual("player2");
  expect(res2).toBeUndefined();
});
