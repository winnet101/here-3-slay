import GameEngine from "./GameEngine";
import { ACTIONS, type HereToSlayChoices } from "./types/choice_types";
import type { Player, PlayerID } from "./types/player_types";
import type { GameState } from "./types/state_types";

class HereToSlayEngine extends GameEngine<
  GameState,
  Player,
  HereToSlayChoices
> {
  paused = false;
  winner = null;

  constructor(
    initialPlayers: { name: string; id: PlayerID }[],
    validator: <K extends keyof HereToSlayChoices>(
      choice: K,
      value: HereToSlayChoices[K],
    ) => boolean,
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
    super({ ...initialState, players });
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

  async chooseAction(): Promise<HereToSlayChoices["takeAction"]> {
    const action = (await this.askCurrentPlayer("takeAction")) ?? [
      { actionType: "passTurn" },
    ];

    return action[0];
  }

  async doAction(action: HereToSlayChoices["takeAction"]) {
    switch (action.actionType) {
      case "passTurn":
        this.passTurn();
        break;
      case "drawCard":
        this.drawCards(this.currentPlayerId);
        break;
      case "playCard":
        const cardIdArray = await this.askCurrentPlayer(
          "chooseCards",
          this.currentPlayer.hand.map((c) => c.id),
        );
        if (!cardIdArray) return;
        const card = cardIdArray[0];

        const resolves = await this.doChallenge();
        if (!resolves) return;
        this.currentPlayer.board.push(
          this.currentPlayer.hand.find((c) => c.id === card)!,
        );
        this.currentPlayer.hand.filter((c) => c.id !== card);

        await this.doAbility();

        break;
    }
  }

  async doChallenge(): Promise<boolean> {
    const validChallengesMap = new Map<string, string[]>();
    this.players.forEach((p) => {
      const challenges = p.hand.filter((c) => c.type === "challenge");
      validChallengesMap.set(
        p.id,
        challenges.map((c) => c.id),
      );
    });

    const [challengerId, cardIdArray] =
      await this.raceAllEnemiesOfCurrentPlayer(
        "chooseCards",
        validChallengesMap,
      );
    if (!cardIdArray) return true; // No player challenged the card; it resolves
    const card = cardIdArray[0];

    const challenger = this.getPlayerByID(challengerId);
    challenger.hand.filter((c) => c.id !== card);

    // Todo: store dice rolls in global state?
    // Ask for a promise so it's interruptible?

    return false;
  }

  async doAbility() {}

  passTurn() {
    this.currentPlayer.actionPoints = 0;
  }

  drawCards(playerID: PlayerID, number = 1) {
    const player = this.getPlayerByID(playerID);
    if (this.state.deck.length > 0) {
      const drawnCard = this.state.deck.pop()!;
      player.hand.push(drawnCard);
    }
  }

  async sacrificeCards(playerID: PlayerID, number = 1) {
    const player = this.getPlayerByID(playerID);
    const cardIds = await this.askCurrentPlayer(
      "chooseCards",
      player.board.map((c) => c.id),
      number,
    );

    if (!cardIds) return;
    player.board.filter((card) => !cardIds.includes(card.id));
  }

  async discardCards(playerID: PlayerID, number = 1) {
    const player = this.getPlayerByID(playerID);
    const cardIds = await this.askPlayer(
      "chooseCards",
      playerID,
      player.hand.map((c) => c.id),
      number,
    );

    if (!cardIds) return;
    player.hand.filter((card) => !cardIds.includes(card.id));
  }

  async playCardDirectly(playerID: PlayerID) {
    const player = this.getPlayerByID(playerID);
    const cardId = await this.askPlayer(
      "chooseCards",
      playerID,
      player.hand.map((c) => c.id),
    );

    if (!cardId) return;

    player.hand.forEach((card, i) => {
      if (cardId.includes(card.id)) {
        player.hand.splice(i, 1);
        // Play card here
      }
    });
  }

  async destroyCards(playerID: PlayerID, number = 1) {
    const cardIds = await this.askPlayer(
      "chooseCards",
      playerID,
      this.getPlayers().flatMap((player) =>
        player.board.flatMap((card) => card.id),
      ),
      number,
    );

    if (!cardIds) return;

    this.players.forEach((player) => {
      player.board.filter((card) => !cardIds.includes(card.id));
    });
  }

  async stealCards(playerID: PlayerID, number = 1) {
    const cardIds = await this.askPlayer(
      "chooseCards",
      playerID,
      this.getPlayers().flatMap((player) =>
        player.board.flatMap((card) => card.id),
      ),
      number,
    );

    if (!cardIds) return;
    const actingPlayer = this.getPlayerByID(playerID);

    this.players.forEach((player) => {
      player.board.forEach((card, i) => {
        if (cardIds.includes(card.id)) {
          actingPlayer.board.push(card);
          player.board.splice(i, 1);
        }
      });
    });
  }
}

export { HereToSlayEngine };
