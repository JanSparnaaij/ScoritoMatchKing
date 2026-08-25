import { StrategyType } from "@/domain/enums";
import { expectedPointsForCandidate } from "@/domain/matchking";
import { normalizedProbabilitiesFromOneXTwo, probabilityFromDecimalOdds } from "@/domain/odds";
import { pickByStrategy } from "@/domain/optimizer";
import { estimateExpectedGoals, scorelineMatrix } from "@/domain/poisson";
import type { MatchInput, MatchPrediction } from "@/domain/types";

export function buildMatchPrediction(match: MatchInput): MatchPrediction {
  const implied = normalizedProbabilitiesFromOneXTwo(match.oneXTwoOdds);
  const over25Probability = match.over25Odds ? probabilityFromDecimalOdds(match.over25Odds) : 0.5;
  const bttsProbability = match.bttsYesOdds ? probabilityFromDecimalOdds(match.bttsYesOdds) : 0.5;

  const xg = estimateExpectedGoals(implied, over25Probability, bttsProbability);
  const matrix = scorelineMatrix(xg.home, xg.away, 5);

  const candidates = matrix.map((row) => {
    const scoreline = `${row.homeGoals}-${row.awayGoals}`;
    const expectedPoints = expectedPointsForCandidate(row.homeGoals, row.awayGoals, matrix);
    return {
      scoreline,
      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,
      probability: row.probability,
      expectedPoints,
    };
  });

  const topScorelines = candidates
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 5)
    .map((candidate) => ({
      scoreline: candidate.scoreline,
      homeGoals: candidate.homeGoals,
      awayGoals: candidate.awayGoals,
      probability: candidate.probability,
      expectedPoints: candidate.expectedPoints,
    }));

  const strategyPicks: Record<StrategyType, string> = {
    [StrategyType.SAFE]: pickByStrategy(StrategyType.SAFE, candidates),
    [StrategyType.BALANCED]: pickByStrategy(StrategyType.BALANCED, candidates),
    [StrategyType.AGGRESSIVE]: pickByStrategy(StrategyType.AGGRESSIVE, candidates),
  };

  return {
    matchId: match.id,
    recommendedScore: strategyPicks[StrategyType.BALANCED],
    impliedProbabilities: implied,
    expectedGoals: xg,
    topScorelines,
    strategyPicks,
  };
}
