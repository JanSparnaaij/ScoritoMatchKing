import type { ImpliedProbabilities } from "@/domain/odds";

function factorial(value: number): number {
  if (value <= 1) {
    return 1;
  }

  let result = 1;
  for (let i = 2; i <= value; i += 1) {
    result *= i;
  }
  return result;
}

export function poissonProbability(lambda: number, goals: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial(goals);
}

export function estimateExpectedGoals(
  probabilities: ImpliedProbabilities,
  over25Probability = 0.5,
  bttsProbability = 0.5,
): { home: number; away: number } {
  const totalGoals = 1.95 + over25Probability * 1.55 + Math.max(0, bttsProbability - 0.5) * 0.65;

  const balance =
    probabilities.homeWin + probabilities.awayWin > 0
      ? probabilities.homeWin / (probabilities.homeWin + probabilities.awayWin)
      : 0.5;

  const homeShare = clamp(0.22, 0.78, 0.5 + (balance - 0.5) * 0.82);
  let home = totalGoals * homeShare;
  let away = totalGoals - home;

  const minimumSideGoals = bttsProbability >= 0.57 ? 0.95 : bttsProbability >= 0.5 ? 0.75 : 0.55;
  if (home < minimumSideGoals) {
    const delta = minimumSideGoals - home;
    home = minimumSideGoals;
    away = Math.max(0.35, away - delta);
  }

  if (away < minimumSideGoals) {
    const delta = minimumSideGoals - away;
    away = minimumSideGoals;
    home = Math.max(0.35, home - delta);
  }

  home = Number(home.toFixed(3));
  away = Number(away.toFixed(3));

  return { home, away };
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

export function scorelineMatrix(
  homeLambda: number,
  awayLambda: number,
  maxGoals = 5,
): Array<{ homeGoals: number; awayGoals: number; probability: number }> {
  const rows: Array<{ homeGoals: number; awayGoals: number; probability: number }> = [];

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      rows.push({
        homeGoals,
        awayGoals,
        probability: poissonProbability(homeLambda, homeGoals) * poissonProbability(awayLambda, awayGoals),
      });
    }
  }

  return rows;
}
