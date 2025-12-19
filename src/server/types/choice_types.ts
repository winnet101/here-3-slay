import type { Card } from "./card_types";

type Action =
  | "playCard"
  | "passTurn"
  | "drawCard"
  | "triggerAbility"
  | "fightMonster"
  | "wheel";


type BaseActionData = {
    actionType: Action;
}

type TargetCardActionData = BaseActionData & {
    actionType: "playCard" | "triggerAbility" | "fightMonster";
    cardId: string;
}

type NoTargetActionData = BaseActionData & {
    actionType: "passTurn" | "drawCard" | "wheel";
}

export type ActionData = TargetCardActionData | NoTargetActionData;

type Choices = {
  takeAction: ActionData;
  playCard: Card;
};

export type { Choices, Action };
