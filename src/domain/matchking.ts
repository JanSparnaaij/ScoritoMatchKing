export type MatchKingPointsConfig = {
  exactScore: number;
  correctOutcome: number;
  wrongPrediction: number;
};

export const matchKingPointsConfig: MatchKingPointsConfig = {
  exactScore: 5,
  correctOutcome: 2,
  wrongPrediction: 0,
};

export function classifyOutcome(homeGoals: number, awayGoals: number): "HOME" | "DRAW" | "AWAY" {
  if (homeGoals > awayGoals) {
    return "HOME";
  }
  if (homeGoals < awayGoals) {
    return "AWAY";
  }
  return "DRAW";
}

export function pointsForPrediction(
  predictedHomeGoals: number,
  predictedAwayGoals: number,
  actualHomeGoals: number,
  actualAwayGoals: number,
): number {
  if (predictedHomeGoals === actualHomeGoals && predictedAwayGoals === actualAwayGoals) {
    return matchKingPointsConfig.exactScore;
  }

  const predictedOutcome = classifyOutcome(predictedHomeGoals, predictedAwayGoals);
  const actualOutcome = classifyOutcome(actualHomeGoals, actualAwayGoals);

  return predictedOutcome === actualOutcome
    ? matchKingPointsConfig.correctOutcome
    : matchKingPointsConfig.wrongPrediction;
}

export function expectedPointsForCandidate(
  candidateHomeGoals: number,
  candidateAwayGoals: number,
  matrix: Array<{ homeGoals: number; awayGoals: number; probability: number }>,
): number {
  return matrix.reduce((accumulator, row) => {
    const points = pointsForPrediction(candidateHomeGoals, candidateAwayGoals, row.homeGoals, row.awayGoals);
    return accumulator + points * row.probability;
  }, 0);
}
