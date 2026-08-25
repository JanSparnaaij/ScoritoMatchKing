import { StrategyType } from "@/domain/enums";

export function pickByStrategy(
  strategy: StrategyType,
  candidates: Array<{ scoreline: string; probability: number; expectedPoints: number }>,
): string {
  if (candidates.length === 0) {
    return "0-0";
  }

  const sortedByProbability = [...candidates].sort((left, right) => right.probability - left.probability);

  if (strategy === StrategyType.SAFE) {
    return sortedByProbability[0].scoreline;
  }

  if (strategy === StrategyType.BALANCED) {
    const topProbability = sortedByProbability[0].probability;
    const plausibleCandidates = candidates.filter((candidate) => candidate.probability >= topProbability * 0.72);

    const balanced = [...plausibleCandidates]
      .sort((left, right) => {
        const leftScore = balancedCandidateScore(left);
        const rightScore = balancedCandidateScore(right);
        return rightScore - leftScore;
      })
      .at(0);

    return balanced?.scoreline ?? sortedByProbability[0].scoreline;
  }

  const aggressive = [...candidates]
    .sort((left, right) => {
      const leftScore = left.expectedPoints * 0.7 + left.probability * 0.3 + diversificationBonus(left.scoreline);
      const rightScore = right.expectedPoints * 0.7 + right.probability * 0.3 + diversificationBonus(right.scoreline);
      return rightScore - leftScore;
    })
    .at(0);

  return aggressive?.scoreline ?? sortedByProbability[0].scoreline;
}

function balancedCandidateScore(candidate: { scoreline: string; probability: number; expectedPoints: number }): number {
  const [homeGoals, awayGoals] = candidate.scoreline.split("-").map((value) => Number(value));
  const goalSum = homeGoals + awayGoals;
  const bothTeamsScoreBonus = homeGoals > 0 && awayGoals > 0 ? 0.025 : 0;
  const cleanSheetPenalty = goalSum <= 1 && (homeGoals === 0 || awayGoals === 0) ? 0.018 : 0;
  const higherEventBonus = goalSum >= 2 ? Math.min(0.025, goalSum * 0.006) : 0;

  return candidate.probability * 0.62
    + candidate.expectedPoints * 0.34
    + bothTeamsScoreBonus
    + higherEventBonus
    - cleanSheetPenalty;
}

function diversificationBonus(scoreline: string): number {
  const [home, away] = scoreline.split("-").map((value) => Number(value));
  const goalDelta = Math.abs(home - away);
  const goalSum = home + away;
  return goalDelta * 0.03 + goalSum * 0.015;
}
