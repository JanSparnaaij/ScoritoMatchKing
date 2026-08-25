import type { OneXTwoOdds } from "@/domain/types";

export type ImpliedProbabilities = {
  homeWin: number;
  draw: number;
  awayWin: number;
};

export function normalizedProbabilitiesFromOneXTwo(odds: OneXTwoOdds): ImpliedProbabilities {
  const homeRaw = 1 / odds.home;
  const drawRaw = 1 / odds.draw;
  const awayRaw = 1 / odds.away;

  const total = homeRaw + drawRaw + awayRaw;

  return {
    homeWin: homeRaw / total,
    draw: drawRaw / total,
    awayWin: awayRaw / total,
  };
}

export function probabilityFromDecimalOdds(decimalOdds: number): number {
  return decimalOdds > 1 ? 1 / decimalOdds : 0;
}
