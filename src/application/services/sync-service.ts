import { buildMatchPrediction } from "@/application/services/prediction-service";
import { GameVariant } from "@/domain/enums";
import type { MatchDataProvider, OddsDataProvider } from "@/infrastructure/adapters/contracts";
import type { MatchInput } from "@/domain/types";
import type { MatchRepository } from "@/infrastructure/repositories/contracts";

export async function runLocalSync(input: {
  matchProvider: MatchDataProvider;
  oddsProvider: OddsDataProvider;
  matchRepository: MatchRepository;
  variant?: GameVariant;
}) {
  const syncedAt = new Date();
  const scopeSuffix = input.variant ? `-${input.variant.toLowerCase()}` : "";
  const roundCode = `round${scopeSuffix}-${syncedAt.toISOString().slice(0, 16)}`;

  const providerMatches = await input.matchProvider.getUpcomingMatches({ variant: input.variant });

  if (providerMatches.length === 0) {
    throw new Error("Geen matches uit API ontvangen");
  }

  const oddsRows = await input.oddsProvider.getLatestOdds(providerMatches.map((match) => match.id), { variant: input.variant });
  if (oddsRows.length === 0) {
    throw new Error("Geen odds uit API ontvangen");
  }

  const oddsMap = new Map(oddsRows.map((row) => [row.matchId, row.oneXTwo]));

  const matches: MatchInput[] = providerMatches
    .map((match) => {
      const odds = oddsMap.get(match.id);
      if (!odds) {
        return null;
      }

      return {
        ...match,
        oneXTwoOdds: odds,
      } satisfies MatchInput;
    })
    .filter((entry): entry is MatchInput => entry !== null);

  if (matches.length === 0) {
    throw new Error("Geen matches met 1X2 odds beschikbaar");
  }

  const predictions = matches.map((match) => buildMatchPrediction(match));

  await input.matchRepository.saveRoundData({
    roundCode,
    matches,
    predictions,
    syncedAt,
  });

  return {
    roundCode,
    syncedAt: syncedAt.toISOString(),
    syncedMatches: matches.length,
    syncedPlayers: 0,
    predictionCount: predictions.length,
  };
}
