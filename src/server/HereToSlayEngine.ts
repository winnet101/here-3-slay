import GameEngine from "./GameEngine";
import type { Choices } from "./types/choice_types";
import type { Player, PlayerID } from "./types/player_types";
import type { GameState } from "./types/state_types";

class HereToSlayEngine extends GameEngine<GameState, Player, Choices> {
  paused = false;
  winner = null;

  constructor(
    initialPlayers: { name: string; id: PlayerID }[],
    validator: <K extends keyof Choices>(
      choice: K,
      value: Choices[K]
    ) => boolean
  ) {
    const initialState: Omit<GameState, "players"> = {
      phase: "action",
      deck: [],
      graveyard: [],
      activePlayerIndex: 0,
    };
    const players = initialPlayers.map((player) => ({
      ...player,
      maxActionPoints: 3,
      actionPoints: 3,
      hand: [],
      board: [],
    }));
    super({ ...initialState, players }, validator);
  }

  async gameLoop() {
    while (!this.winner && !this.paused) {
      this.doTurn();
    }
  }

  async doTurn() {
    this.currentPlayer.actionPoints = this.currentPlayer.maxActionPoints;
    while (this.currentPlayer.actionPoints > 0) {
      const action = await this.chooseAction();
      this.doAction(action);
    }
    this.nextPlayer();
  }

  async chooseAction(): Promise<Choices["takeAction"]> {
    const action = await this.askPlayer("takeAction");
    if (!action) {
      return { actionType: "passTurn" };
    }
    return action;
  }

  async doAction(action: Choices["takeAction"]) {
    switch (action.actionType) {
      case "passTurn":
        this.passTurn();
        break;
      case "drawCard":
        this.drawCard();
        break;
    }
  }

  passTurn() {
    this.currentPlayer.actionPoints = 0;
  }

  drawCard(playerID: PlayerID = this.currentPlayer.id) {
    const player = this.getPlayerByID(playerID);
    if (player && this.state.deck.length > 0) {
      const drawnCard = this.state.deck.pop()!;
      player.hand.push(drawnCard);
    }
  }
}

export { HereToSlayEngine };
