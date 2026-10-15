import GameEngine from "./GameEngine";
import type { Card } from "./types/card_types";
import { type HereToSlayChoices } from "./types/ActionTypes";
import type { Player, PlayerID } from "./types/player_types";
import type { GameState, ActionPhase } from "./types/GameStateTypes";

class HereToSlayEngine extends GameEngine<
  GameState,
  Player,
  HereToSlayChoices
> {
  paused = false;
  winner = null;

  constructor(initialPlayers: { name: string; id: PlayerID }[]) {
    const initialState: Omit<ActionPhase, "players"> = {
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
      await this.raceAllEnemiesOfCurrentPlayer("chooseCards", (playerId) =>
        this.getPlayer(playerId)
          .hand.filter((c) => c.type === "challenge")
          .map((c) => c.id),
      );

    if (!cardIdArray) return true; // No player challenged the card; it resolves

    const card = cardIdArray[0];
    const challenger = this.getPlayer(challengerId);
    challenger.hand.filter((c) => c.id !== card);

    const ownerRoll = this.rollDice();
    const challengerRoll = this.rollDice();

    await this.doModifierPhase(
      new Map([
        [this.currentPlayerId, ownerRoll],
        [challengerId, challengerRoll],
      ]),
    );

    return ownerRoll >= challengerRoll;

    // Todo: store dice rolls in global state?
    // Ask for a promise so it's interruptible?
  }

  async doModifierPhase(rolls: Map<string, number>) {
    this.state = {
      // expensive. cast instead?
      ...this.state,
      phase: "modifier",
      rolls,
    };

    const [playerId, cardIds] = await this.askForModifier();

    if (cardIds == undefined) return; // End modifier phase.
  }

  async doAbility() {}

  passTurn() {
    this.currentPlayer.actionPoints = 0;
  }

  drawCards(playerID: PlayerID, number = 1) {
    const player = this.getPlayer(playerID);
    if (this.state.deck.length > 0) {
      const drawnCard = this.state.deck.pop()!;
      player.hand.push(drawnCard);
    }
  }

  async sacrificeCards(playerID: PlayerID, number: number): Promise<void>;
  async sacrificeCards(playerIDs: PlayerID[], number: number): Promise<void>;
  async sacrificeCards(playerIDorIDs: PlayerID | PlayerID[], number = 1) {
    const ids = Array.isArray(playerIDorIDs) ? playerIDorIDs : [playerIDorIDs];
    const responses = await this.askForCards.fromOwnBoard(ids, number);
    console.log(responses);

    responses.forEach((cardIds, playerId) => {
      if (!cardIds) {
        Array(number).forEach(() => {
          this.getPlayer(playerId).board.pop();
        });
        return;
      }
      this.getPlayer(playerId).board = this.getPlayer(playerId).board.filter(
        (c) => !cardIds.includes(c.id),
      );
    });
  }

  async discardCards(playerID: PlayerID, number = 1) {
    const player = this.getPlayer(playerID);
    const cardIds = await this.askPlayer(
      "chooseCards",
      playerID,
      player.hand.map((c) => c.id),
      number,
    );

    if (!cardIds) return;
    player.hand = player.hand.filter((card) => !cardIds.includes(card.id));
  }

  async playCardDirectly(playerID: PlayerID) {
    const player = this.getPlayer(playerID);
    const cardId = await this.askPlayer(
      "chooseCards",
      playerID,
      player.hand.map((c) => c.id),
    );

    if (!cardId) return;

    player.hand = player.hand.filter((card) => !cardId.includes(card.id));
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
      player.board = player.board.filter((card) => !cardIds.includes(card.id));
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
    const actingPlayer = this.getPlayer(playerID);

    this.players.forEach((player) => {
      player.board.forEach((card, i) => {
        if (cardIds.includes(card.id)) {
          actingPlayer.board.push(card);
          player.board.splice(i, 1);
        }
      });
    });
  }

  rollDice(number = 2): number {
    return Array(number).reduce(
      (prev) => prev + Math.ceil(Math.random() * 6),
      0,
    );
  }

  private async askForModifier() {
    return Promise.race(
      this.collectChoices(
        [
          {
            choice: "chooseCards",
            validValueCreator: (id) =>
              this.getPlayer(id)
                .hand.filter((c) => c.type === "modifier")
                .map((c) => c.id),
          },
          { choice: "chooseModifier" },
        ],
        this.getPlayers().map((p) => p.id),
      ).map(async ([k, v]) => [k, await v] as const),
    );
  }

  private get askForCards() {
    return {
      fromOwnBoard: (
        ids: PlayerID[],
        number: number,
        filter?: (c: Card) => boolean,
      ) => {
        if (filter === undefined) filter = () => true;

        return this.ask(
          "chooseCards",
          ids,
          (playerId) =>
            this.getPlayer(playerId)
              .board.filter(filter)
              .map((c) => c.id),
          number,
        );
      },
      fromOwnHand: (
        ids: PlayerID[],
        number: number,
        filter?: (c: Card) => boolean,
      ) => {
        if (filter === undefined) filter = () => true;

        return this.ask(
          "chooseCards",
          ids,
          (playerId) =>
            this.getPlayer(playerId)
              .hand.filter(filter)
              .map((c) => c.id),
          number,
        );
      },
    };
  }
}

export { HereToSlayEngine };
