export interface BaseCard {
  name: string;
  id: string;
  type: "challenge" | "hero" | "modifier";
}

interface ModifierCard extends BaseCard {
  type: "modifier";
  positive: number;
  negative: number;
  effect?: undefined;
}

interface ChallengeCard extends BaseCard {
  type: "challenge";
}

interface HeroCard extends BaseCard {
  type: "hero";
}

export type Card = ModifierCard | ChallengeCard | HeroCard;
