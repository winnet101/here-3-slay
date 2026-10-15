import { expect, test, vi } from "vitest";
import GameEngine from "../GameEngine";

test("a player can answer a new prompt after their previous prompt times out", async () => {
  vi.useFakeTimers();
  try {
    const engine = new GameEngine<{}, { id: string }, { number: number }>({
      players: [{ id: "player1" }],
    });
    engine.defaultTimeoutMs = 10;
    const first = engine.ask("number", ["player1"]);
    await vi.advanceTimersByTimeAsync(10);
    expect((await first).get("player1")).toBeUndefined();

    const next = engine.ask("number", ["player1"]);
    expect(engine.resolveChoice("player1", "number", [2]).kind).toBe("ok");
    expect((await next).get("player1")).toEqual([2]);
  } finally {
    vi.useRealTimers();
  }
});

test("unanswered players can answer a new prompt after another player wins a race", async () => {
  const engine = new GameEngine<{}, { id: string }, { number: number }>({
    players: [{ id: "player1" }, { id: "player2" }],
  });
  engine.defaultTimeoutMs = 0;
  const race = engine.race("number", ["player1", "player2"]);
  engine.resolveChoice("player1", "number", [1]);
  await expect(race).resolves.toEqual(["player1", [1]]);

  const next = engine.ask("number", ["player2"], () => [2, 3], 2);
  // This is an automatic selection, and must not answer the stale race request.
  expect((await next).get("player2")).toEqual([2, 3]);
  expect(engine.resolveChoice("player2", "number", [4]).kind).toBe("err");
});
