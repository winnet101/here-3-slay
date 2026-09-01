import { expect, test } from "vitest";
import { HereToSlayEngine } from "../HereToSlayEngine";
import { wait } from "../lib/withTimeout";

const initialPlayers = [
  {
    id: "1",
    name: "A",
  },
  {
    id: "2",
    name: "B",
  },
];

test("Sacrifice", async () => {
  const engine = new HereToSlayEngine(initialPlayers, () => true);
  engine
    .getPlayerByID("1")
    .board.push(
      { name: "cardA", id: "1", type: "hero" },
      { name: "cardB", id: "2", type: "hero" },
      { name: "cardC", id: "3", type: "hero" },
    );

  engine.sacrificeCards("1", 1);
  await wait(0);
  engine.resolveChoice("1", "chooseCards", ["2"]);
  await wait(0);

  expect(
    engine
      .getStateSnapshot()
      .players.find((p) => p.id === "1")
      ?.board.map((c) => c.id),
  ).toEqual(["1", "3"]);
});

test("Sacrifice multiple", async () => {
  const engine = new HereToSlayEngine(initialPlayers, () => true);
  engine
    .getPlayerByID("1")
    .board.push(
      { name: "cardA", id: "1", type: "hero" },
      { name: "cardB", id: "2", type: "hero" },
      { name: "cardC", id: "3", type: "hero" },
      { name: "cardD", id: "4", type: "hero" },
    );

  engine.sacrificeCards("1", 2);
  await wait(0);
  engine.resolveChoice("1", "chooseCards", ["2", "4"]);
  await wait(0);

  expect(
    engine
      .getStateSnapshot()
      .players.find((p) => p.id === "1")
      ?.board.map((c) => c.id),
  ).toEqual(["1", "3"]);
});
