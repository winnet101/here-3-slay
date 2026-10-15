import type { Card } from "./card_types";

export type Action =
  | "playCard"
  | "passTurn"
  | "drawCard"
  | "triggerAbility"
  | "fightMonster"
  | "wheel";

export const ACTIONS: { kind: Action; cost: number }[] = [
  {
    kind: "passTurn",
    cost: 0,
  },

  {
    kind: "playCard",
    cost: 1,
  },
];

type BaseActionData = {
  actionType: Action;
};

type TargetCardActionData = BaseActionData & {
  actionType: "playCard" | "triggerAbility" | "fightMonster";
  cardId: string;
};

type NoTargetActionData = BaseActionData & {
  actionType: "passTurn" | "drawCard" | "wheel";
};

export type ActionData = TargetCardActionData | NoTargetActionData;

export type HereToSlayChoices = {
  takeAction: ActionData;
  chooseCards: string;
  chooseModifier: "positive" | "negative";
};
