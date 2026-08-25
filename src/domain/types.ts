import { GameVariant, StrategyType } from "@/domain/enums";

export type OneXTwoOdds = {
  home: number;
  draw: number;
  away: number;
};

export type MatchInput = {
  id: string;
  variant: GameVariant;
  competition: string;
  kickOffUtc: string;
  homeTeam: string;
  awayTeam: string;
  oneXTwoOdds: OneXTwoOdds;
  over25Odds?: number;
  under25Odds?: number;
  bttsYesOdds?: number;
  bttsNoOdds?: number;
};

export type ScorelineProbability = {
  scoreline: string;
  homeGoals: number;
  awayGoals: number;
  probability: number;
  expectedPoints: number;
};

export type MatchPrediction = {
  matchId: string;
  recommendedScore: string;
  impliedProbabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
  expectedGoals: {
    home: number;
    away: number;
  };
  topScorelines: ScorelineProbability[];
  strategyPicks: Record<StrategyType, string>;
};
