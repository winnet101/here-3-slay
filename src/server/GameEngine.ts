import ChoiceManager from "./ChoiceManager";
import { withTimeout } from "./lib/serverUtil";
import type { Player, PlayerID } from "./types/player_types";

class GameEngine<
  S extends object,
  P extends { id: PlayerID },
  Choices extends Record<string, unknown>
> {
  protected state: S;
  protected players: Map<PlayerID, P>;
  protected choiceManagers: Map<PlayerID, ChoiceManager<Choices>>;
  protected playerOrder: PlayerID[];
  protected currentPlayerIndex: number = 0;
  protected nextPlayerIndex: number | undefined = undefined;
  defaultTimeoutMs = 20000; // 20 seconds

  constructor(
    initialState: S & { players: P[] },
    validator: <K extends keyof Choices>(
      choice: K,
      value: Choices[K]
    ) => boolean
  ) {
    this.state = initialState;
    this.players = new Map();
    this.choiceManagers = new Map();

    initialState.players.forEach((player) => {
      this.players.set(player.id, player);
      this.choiceManagers.set(player.id, new ChoiceManager<Choices>(validator));
    });

    this.playerOrder = initialState.players.map((player) => player.id);
  }

  getStateSnapshot(): S & { players: P[] } {
    return {
      ...this.state,
      players: Array.from(this.players.values()).sort(
        (a, b) =>
          this.playerOrder.indexOf(a.id) - this.playerOrder.indexOf(b.id)
      ),
    };
  }

  get currentPlayer(): P {
    return this.players.get(this.playerOrder[this.currentPlayerIndex])!;
  }

  getPlayers(): P[] {
    return Array.from(this.players.values());
  }

  getPlayerByID(id: PlayerID): P | undefined {
    return this.players.get(id);
  }

  setNextPlayer(index: number): void;
  setNextPlayer(id: PlayerID): void;
  setNextPlayer(param: number | PlayerID): void {
    if (typeof param === "number") {
      this.nextPlayerIndex = param % this.players.size;
    } else {
      this.nextPlayerIndex = this.playerOrder.indexOf(param);
    }
  }

  nextPlayer(): void {
    if (this.nextPlayerIndex !== undefined) {
      this.currentPlayerIndex = this.nextPlayerIndex;
      this.nextPlayerIndex = undefined;
      return;
    }
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.size;
  }

  private collectChoices<K extends keyof Choices>(
    choice: K,
    playerIDs: PlayerID[]
  ) {
    const choicePromises = playerIDs.map((id) => {
      const choiceManager = this.choiceManagers.get(id);
      // TODO: might not want this to throw error
      if (!choiceManager) {
        throw new Error(`ChoiceManager not found for player ID: ${id}`);
      }
      return [
        id,
        withTimeout(choiceManager.setChoice(choice), this.defaultTimeoutMs),
      ] as const;
    });
    return choicePromises;
  }

  /**
   * @param choice Returns an array of all choices
   * @param playerIDs Roster of players to make the choice
   * @returns An array of tuples containing the ID of each player and their choice
   */
  async makeChoices<K extends keyof Choices>(choice: K, playerIDs: PlayerID[]) {
    const choicePromises = this.collectChoices(choice, playerIDs);
    const results = await Promise.all(
      choicePromises.map(async ([id, prom]) => [id, await prom] as const)
    );
    return results;
  }

  /**
   * @param choice Returns the choice of the first player to respond
   * @param playerIDs Roster of players to make the choice
   * @returns A tuple containing the ID of the player who responded first and their choice
   */
  async raceChoice<K extends keyof Choices>(choice: K, playerIDs: PlayerID[]) {
    const choicePromises = this.collectChoices(choice, playerIDs);
    const result = await Promise.race(
      choicePromises.map(async ([id, prom]) => [id, await prom] as const)
    );
    return result;
  }

  async askAll<K extends keyof Choices>(choice: K) {
    return await this.makeChoices(choice, this.playerOrder);
  }

  async askAllEnemies<K extends keyof Choices>(
    choice: K,
    playerID: PlayerID = this.currentPlayer.id
  ) {
    const enemyIDs = this.playerOrder.filter((id) => id !== playerID);
    return await this.makeChoices(choice, enemyIDs);
  }

  async askPlayer<K extends keyof Choices>(choice: K, playerID: PlayerID = this.currentPlayer.id) {
    const choices = await this.makeChoices(choice, [playerID]);
    return choices[0][1];
  }

  async raceAll<K extends keyof Choices>(choice: K) {
    return await this.raceChoice(choice, this.playerOrder);
  }

  async raceAllEnemies<K extends keyof Choices>(
    choice: K,
    playerID: PlayerID = this.currentPlayer.id
  ) {
    const enemyIDs = this.playerOrder.filter((id) => id !== playerID);
    return await this.raceChoice(choice, enemyIDs);
  }

  resolveChoice(playerID: PlayerID, value: Choices[keyof Choices]): boolean {
    const choiceManager = this.choiceManagers.get(playerID);
    if (!choiceManager) {
      throw new Error(`ChoiceManager not found for player ID: ${playerID}`);
    }
    return this.choiceManagers.get(playerID)!.resolveChoice(value);
  }
}

export default GameEngine;
