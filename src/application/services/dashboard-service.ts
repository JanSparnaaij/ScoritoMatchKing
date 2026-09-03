import { format, startOfISOWeek } from "date-fns";
import { buildMatchPrediction } from "@/application/services/prediction-service";
import { GameVariant, StrategyType } from "@/domain/enums";
import type { MatchRepository } from "@/infrastructure/repositories/contracts";

export async function buildDashboardView(input: {
  matchRepository: MatchRepository;
  variant?: GameVariant;
  selectedRound?: number;
}) {
  const [matches, lastSyncAt] = await Promise.all([
    input.matchRepository.getPersistedMatches(input.variant),
    input.matchRepository.getLastSyncAt(input.variant),
  ]);

  const groupedRounds = splitIntoMatchRounds(matches);
  const roundStartNumber = resolveRoundStartNumber(input.variant, matches);
  const normalizedSelectedRound =
    input.selectedRound && input.selectedRound >= 1 && input.selectedRound <= groupedRounds.length
      ? input.selectedRound
      : 1;

  const selectedMatches = groupedRounds[normalizedSelectedRound - 1] ?? [];

  const predictions = selectedMatches.map((match) => ({
    match,
    prediction: buildMatchPrediction(match),
  }));

  return {
    syncedAtLabel: format(lastSyncAt ?? new Date(), "yyyy-MM-dd HH:mm"),
    selectedRound: normalizedSelectedRound,
    rounds: groupedRounds.map((roundMatches, index) => ({
      roundNumber: index + 1,
      label: `Speelronde ${roundStartNumber + index}`,
      matchesCount: roundMatches.length,
      dateRangeLabel: formatRoundDateRange(roundMatches),
      isSelected: normalizedSelectedRound === index + 1,
    })),
    kpis: [
      { label: "Speelrondes", value: String(groupedRounds.length) },
      { label: "Wedstrijden", value: String(predictions.length) },
      { label: "Voorspellingen", value: String(predictions.length * 3) },
    ],
    matchCards: predictions.map(({ match, prediction }) => ({
      matchId: match.id,
      title: `${match.homeTeam} - ${match.awayTeam}`,
      competition: `${match.variant} / ${match.competition}`,
      recommendedScore: prediction.recommendedScore,
      safeScore: prediction.strategyPicks[StrategyType.SAFE],
      aggressiveScore: prediction.strategyPicks[StrategyType.AGGRESSIVE],
      odds: {
        home: match.oneXTwoOdds.home.toFixed(2),
        draw: match.oneXTwoOdds.draw.toFixed(2),
        away: match.oneXTwoOdds.away.toFixed(2),
      },
      topScorelines: prediction.topScorelines.map((entry) => ({
        scoreline: entry.scoreline,
        probability: `${(entry.probability * 100).toFixed(1)}%`,
        expectedPoints: entry.expectedPoints.toFixed(2),
      })),
    })),
  };
}

function splitIntoMatchRounds(matches: Awaited<ReturnType<MatchRepository["getUpcoming"]>>): typeof matches[] {
  if (matches.length === 0) {
    return [];
  }

  const sorted = [...matches].sort((left, right) => Date.parse(left.kickOffUtc) - Date.parse(right.kickOffUtc));
  const groups = new Map<number, typeof matches>();

  for (const match of sorted) {
    const weekKey = startOfISOWeek(new Date(match.kickOffUtc)).getTime();
    const bucket = groups.get(weekKey);
    if (bucket) {
      bucket.push(match);
    } else {
      groups.set(weekKey, [match]);
    }
  }

  return Array.from(groups.values()).slice(0, 4);
}

function formatRoundDateRange(matches: Awaited<ReturnType<MatchRepository["getUpcoming"]>>): string {
  if (matches.length === 0) {
    return "onbekend";
  }

  const sorted = [...matches].sort((left, right) => Date.parse(left.kickOffUtc) - Date.parse(right.kickOffUtc));
  const start = new Date(sorted[0].kickOffUtc);
  const end = new Date(sorted[sorted.length - 1].kickOffUtc);

  if (start.toDateString() === end.toDateString()) {
    return format(start, "d MMM");
  }

  return `${format(start, "d MMM")} - ${format(end, "d MMM")}`;
}

function resolveRoundStartNumber(
  variant: GameVariant | undefined,
  matches: Awaited<ReturnType<MatchRepository["getUpcoming"]>>,
): number {
  if (!variant || matches.length === 0) {
    return 1;
  }

  const defaultStart = DEFAULT_ROUND_START_BY_VARIANT[variant] ?? 1;

  // For domestic leagues at season start, the first upcoming cluster is often matchday 2.
  if (variant === GameVariant.NL || variant === GameVariant.KKD || variant === GameVariant.BE) {
    const firstKickoff = new Date(matches[0].kickOffUtc);
    const isEarlySeason = firstKickoff.getUTCMonth() === 7 && firstKickoff.getUTCDate() >= 8;
    if (isEarlySeason) {
      return Math.max(2, defaultStart);
    }
  }

  return defaultStart;
}

const DEFAULT_ROUND_START_BY_VARIANT: Partial<Record<GameVariant, number>> = {
  [GameVariant.NL]: 2,
  [GameVariant.KKD]: 2,
  [GameVariant.BE]: 2,
  [GameVariant.INT]: 1,
  [GameVariant.EUR]: 1,
  [GameVariant.INTERLANDS]: 1,
};
