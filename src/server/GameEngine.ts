import ChoiceManager, {
  type ChoiceDefinition,
  type KeyOf,
} from "./ChoiceManager";
import type { Result } from "./lib/Result";
import { withTimeout } from "./lib/withTimeout";
import type { Player, PlayerID } from "./types/player_types";

type ChoiceRequest<Choices extends Record<string, unknown>> = {
  [K in KeyOf<Choices>]: {
    readonly choice: K;
    readonly validValueCreator?: (playerID: PlayerID) => Choices[K][];
    readonly numberOfValues?: number;
  };
}[KeyOf<Choices>];

type ResolvedChoiceRequests<
  Choices extends Record<string, unknown>,
  Requests extends readonly ChoiceRequest<Choices>[],
> = {
  [Index in keyof Requests]: Requests[Index] extends {
    readonly choice: infer K extends KeyOf<Choices>;
  }
    ? Extract<ChoiceDefinition<Choices>, { readonly choice: K }>
    : never;
};

class GameEngine<
  S extends object,
  P extends { id: PlayerID },
  Choices extends Record<string, unknown>,
> {
  protected state: S;
  protected players: Map<PlayerID, P>;
  protected choiceManagers: Map<PlayerID, ChoiceManager<Choices>>;
  protected playerOrder: PlayerID[];
  protected currentIndex: number = 0;
  protected overridenNextPlayerIndex: number | undefined = undefined;

  defaultTimeoutMs = 20000; // 20 seconds

  constructor(initialState: S & { players: P[] }) {
    this.state = initialState;
    this.players = new Map();
    this.choiceManagers = new Map();

    initialState.players.forEach((player) => {
      this.players.set(player.id, player);
      this.choiceManagers.set(player.id, new ChoiceManager<Choices>());
    });

    this.playerOrder = initialState.players.map((player) => player.id);
  }

  getStateSnapshot(): S & { players: P[] } {
    return {
      ...this.state,
      players: Array.from(this.players.values()).sort(
        (a, b) =>
          this.playerOrder.indexOf(a.id) - this.playerOrder.indexOf(b.id),
      ),
    };
  }

  get currentPlayer(): P {
    return this.players.get(this.playerOrder[this.currentIndex])!;
  }

  get currentPlayerId(): string {
    return this.currentPlayer.id;
  }

  getPlayers(): P[] {
    return Array.from(this.players.values());
  }

  getPlayer(id: PlayerID): P {
    try {
      return this.players.get(id)!;
    } catch {
      throw new Error(`Player with id ${id} not found`);
    }
  }

  setNextPlayer(index: number): void;
  setNextPlayer(id: PlayerID): void;
  setNextPlayer(param: number | PlayerID): void {
    if (typeof param === "number") {
      this.overridenNextPlayerIndex = param % this.players.size;
    } else {
      this.overridenNextPlayerIndex = this.playerOrder.indexOf(param);
    }
  }

  nextPlayer(): void {
    if (this.overridenNextPlayerIndex !== undefined) {
      this.currentIndex = this.overridenNextPlayerIndex;
      this.overridenNextPlayerIndex = undefined;
      return;
    }
    this.currentIndex = (this.currentIndex + 1) % this.players.size;
  }

  protected collectChoices<
    const Requests extends readonly ChoiceRequest<Choices>[],
  >(requests: Requests, playerIDs: PlayerID[]) {
    const choicePromises = playerIDs.map((id) => {
      if (!this.choiceManagers.has(id))
        throw new Error(`ChoiceManager not found for player ID: ${id}`);

      // A new prompt replaces any unanswered race or timed-out request.
      const choiceManager = new ChoiceManager<Choices>();
      this.choiceManagers.set(id, choiceManager);

      return [
        id,
        withTimeout(
          this.choiceManagers.get(id)!.setChoices(
            requests.map(({ choice, validValueCreator, numberOfValues }) => ({
              choice,
              validValues: validValueCreator?.(id),
              numberOfValues,
            })),
          ),
          this.defaultTimeoutMs,
        ),
      ] as const;
    });
    return choicePromises;
  }

  /**
   * @param choice Returns an array of all choices
   * @param playerIDs Roster of players to make the choice
   * @returns A map containing the ID of each player and their choice
   */
  async ask<K extends string & keyof Choices>(
    choice: K,
    playerIDs: PlayerID[],
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    const choicePromises = this.collectChoices(
      [{ choice, validValueCreator, numberOfValues }],
      playerIDs,
    );
    const results = await Promise.all(
      choicePromises.map(
        async ([id, prom]) => [id, (await prom)?.[choice]] as const,
      ),
    );
    return new Map(results);
  }

  /**
   * @param choice Returns the choice of the first player to respond
   * @param playerIDs Roster of players to make the choice
   * @returns A tuple containing the ID of the player who responded first and their choice
   */
  async race<K extends string & keyof Choices>(
    choice: K,
    playerIDs: PlayerID[],
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    const choicePromises = this.collectChoices(
      [{ choice, validValueCreator, numberOfValues }],
      playerIDs,
    );
    const result = await Promise.race(
      choicePromises.map(
        async ([id, prom]) => [id, (await prom)?.[choice]] as const,
      ),
    );
    return result;
  }

  async askAll<K extends string & keyof Choices>(
    choice: K,
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    return await this.ask(
      choice,
      this.playerOrder,
      validValueCreator,
      numberOfValues,
    );
  }

  async askAllEnemies<K extends string & keyof Choices>(
    choice: K,
    ofPlayerID: PlayerID,
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    const enemyIDs = this.playerOrder.filter((id) => id !== ofPlayerID);
    return await this.ask(choice, enemyIDs, validValueCreator, numberOfValues);
  }

  async askAllEnemiesOfCurrentPlayer<K extends string & keyof Choices>(
    choice: K,
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    return await this.askAllEnemies(
      choice,
      this.currentPlayer.id,
      validValueCreator,
      numberOfValues,
    );
  }

  async askPlayer<K extends string & keyof Choices>(
    choice: K,
    playerID: PlayerID,
    validValues?: Choices[K][],
    numberOfValues = 1,
  ) {
    const choices = await this.ask(
      choice,
      [playerID],
      validValues ? () => validValues : undefined,
      numberOfValues,
    );
    return choices.get(this.currentPlayer.id);
  }

  async askCurrentPlayer<K extends string & keyof Choices>(
    choice: K,
    validValues?: Choices[K][],
    numberOfValues = 1,
  ) {
    return await this.askPlayer(
      choice,
      this.currentPlayer.id,
      validValues,
      numberOfValues,
    );
  }

  async raceAll<K extends string & keyof Choices>(
    choice: K,
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    return await this.race(
      choice,
      this.playerOrder,
      validValueCreator,
      numberOfValues,
    );
  }

  async raceAllEnemies<K extends string & keyof Choices>(
    choice: K,
    playerID: PlayerID,
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    const enemyIDs = this.playerOrder.filter((id) => id !== playerID);
    return await this.race(choice, enemyIDs, validValueCreator, numberOfValues);
  }

  async raceAllEnemiesOfCurrentPlayer<K extends string & keyof Choices>(
    choice: K,
    validValueCreator?: (currentID: PlayerID) => Choices[K][],
    numberOfValues = 1,
  ) {
    return await this.raceAllEnemies(
      choice,
      this.currentPlayer.id,
      validValueCreator,
      numberOfValues,
    );
  }

  resolveChoice<K extends string & keyof Choices>(
    playerID: PlayerID,
    choice: K,
    values: Choices[K][],
  ): Result {
    const choiceManager = this.choiceManagers.get(playerID);
    if (!choiceManager)
      throw new Error(`ChoiceManager not found for player ID: ${playerID}`);

    return choiceManager.resolveChoice(choice, values);
  }
}

export default GameEngine;
