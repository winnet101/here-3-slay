import type { Card } from "./card_types";
import type { Player } from "./player_types";

type GamePhase = "action" | "challenge" | "modifier";

interface GameState {
  phase: GamePhase
  players: Player[];
  deck: Card[];
  graveyard: Card[];
  activePlayerIndex: number;
}

export type { GameState };
