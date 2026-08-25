import { GameVariant } from "@/domain/enums";
import type { MatchInput } from "@/domain/types";

export const fixtureMatches: MatchInput[] = [
  {
    id: "nl-001",
    variant: GameVariant.NL,
    competition: "Eredivisie",
    kickOffUtc: "2026-08-08T18:00:00.000Z",
    homeTeam: "Ajax",
    awayTeam: "PSV",
    oneXTwoOdds: { home: 2.55, draw: 3.5, away: 2.7 },
    over25Odds: 1.72,
    under25Odds: 2.18,
    bttsYesOdds: 1.66,
    bttsNoOdds: 2.2,
  },
  {
    id: "be-001",
    variant: GameVariant.BE,
    competition: "Pro League",
    kickOffUtc: "2026-08-09T14:00:00.000Z",
    homeTeam: "Club Brugge",
    awayTeam: "Anderlecht",
    oneXTwoOdds: { home: 2.1, draw: 3.4, away: 3.35 },
    over25Odds: 1.87,
    under25Odds: 1.95,
    bttsYesOdds: 1.74,
    bttsNoOdds: 2.07,
  },
  {
    id: "int-001",
    variant: GameVariant.INT,
    competition: "Champions League",
    kickOffUtc: "2026-08-10T19:00:00.000Z",
    homeTeam: "Real Madrid",
    awayTeam: "Bayern",
    oneXTwoOdds: { home: 2.2, draw: 3.65, away: 3.05 },
    over25Odds: 1.68,
    under25Odds: 2.24,
    bttsYesOdds: 1.62,
    bttsNoOdds: 2.31,
  },
];
