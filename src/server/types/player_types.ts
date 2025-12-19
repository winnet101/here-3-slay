import type { Card } from "./card_types";

type PlayerID = string;

interface Player {
    id: PlayerID;
    name: string;
    hand: Card[];
    board: Card[];
    actionPoints: number;
    maxActionPoints: number;
}

export type { PlayerID, Player };