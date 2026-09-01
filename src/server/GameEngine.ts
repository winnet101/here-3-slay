import ChoiceManager from "./ChoiceManager";
import type { Result } from "./lib/Result";
import { withTimeout } from "./lib/withTimeout";
import type { PlayerID } from "./types/player_types";

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

  getPlayerByID(id: PlayerID): P {
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

  private collectChoices<K extends string & keyof Choices>(
    choice: K,
    playerIDs: PlayerID[],
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    const choicePromises = playerIDs.map((id) => {
      const choiceManager = this.choiceManagers.get(id);
      if (!choiceManager)
        throw new Error(`ChoiceManager not found for player ID: ${id}`);

      return [
        id,
        withTimeout(
          choiceManager.setChoice(choice, validValues?.get(id), numberOfValues),
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
  async makeChoices<K extends string & keyof Choices>(
    choice: K,
    playerIDs: PlayerID[],
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    const choicePromises = this.collectChoices(
      choice,
      playerIDs,
      validValues,
      numberOfValues,
    );
    const results = await Promise.all(
      choicePromises.map(async ([id, prom]) => [id, await prom] as const),
    );
    return new Map(results);
  }

  /**
   * @param choice Returns the choice of the first player to respond
   * @param playerIDs Roster of players to make the choice
   * @returns A tuple containing the ID of the player who responded first and their choice
   */
  async raceChoice<K extends string & keyof Choices>(
    choice: K,
    playerIDs: PlayerID[],
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    const choicePromises = this.collectChoices(
      choice,
      playerIDs,
      validValues,
      numberOfValues,
    );
    const result = await Promise.race(
      choicePromises.map(async ([id, prom]) => [id, await prom] as const),
    );
    return result;
  }

  async askAll<K extends string & keyof Choices>(
    choice: K,
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    return await this.makeChoices(
      choice,
      this.playerOrder,
      validValues,
      numberOfValues,
    );
  }

  async askAllEnemies<K extends string & keyof Choices>(
    choice: K,
    ofPlayerID: PlayerID,
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    const enemyIDs = this.playerOrder.filter((id) => id !== ofPlayerID);
    return await this.makeChoices(
      choice,
      enemyIDs,
      validValues,
      numberOfValues,
    );
  }

  async askAllEnemiesOfCurrentPlayer<K extends string & keyof Choices>(
    choice: K,
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    return await this.askAllEnemies(
      choice,
      this.currentPlayer.id,
      validValues,
      numberOfValues,
    );
  }

  async askPlayer<K extends string & keyof Choices>(
    choice: K,
    playerID: PlayerID,
    validValues?: Choices[K][],
    numberOfValues = 1,
  ) {
    const choices = await this.makeChoices(
      choice,
      [playerID],
      validValues ? new Map([[playerID, validValues]]) : undefined,
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
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    return await this.raceChoice(
      choice,
      this.playerOrder,
      validValues,
      numberOfValues,
    );
  }

  async raceAllEnemies<K extends string & keyof Choices>(
    choice: K,
    playerID: PlayerID,
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    const enemyIDs = this.playerOrder.filter((id) => id !== playerID);
    return await this.raceChoice(choice, enemyIDs, validValues, numberOfValues);
  }

  async raceAllEnemiesOfCurrentPlayer<K extends string & keyof Choices>(
    choice: K,
    validValues?: Map<PlayerID, Choices[K][]>,
    numberOfValues = 1,
  ) {
    return await this.raceAllEnemies(
      choice,
      this.currentPlayer.id,
      validValues,
      numberOfValues,
    );
  }

  resolveChoice<K extends string & keyof Choices>(
    playerID: PlayerID,
    choice: K,
    values: Choices[K][],
  ): Result {
    const choiceManager = this.choiceManagers.get(playerID);
    if (!choiceManager) {
      throw new Error(`ChoiceManager not found for player ID: ${playerID}`);
    }
    return this.choiceManagers.get(playerID)!.resolveChoice(choice, values);
  }
}

export default GameEngine;
