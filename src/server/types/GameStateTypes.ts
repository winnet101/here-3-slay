import type { Card } from "./card_types";
import type { Player, PlayerID } from "./player_types";

type GamePhase = "action" | "challenge" | "modifier";

export interface BaseState {
  phase: GamePhase;
  players: Player[];
  deck: Card[];
  graveyard: Card[];
  activePlayerIndex: number;
}

export interface ActionPhase extends BaseState {
  phase: "action" | "challenge";
}

export interface ModifierPhase extends BaseState {
  phase: "modifier";
  rolls: Map<PlayerID, number>;
}

export type GameState = ActionPhase | ModifierPhase;
