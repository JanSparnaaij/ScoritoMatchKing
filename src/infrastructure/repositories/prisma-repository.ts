import { Prisma, type GameVariant as PrismaGameVariant } from "@prisma/client";
import { GameVariant, StrategyType } from "@/domain/enums";
import type { MatchInput, MatchPrediction } from "@/domain/types";
import { prisma } from "@/lib/prisma";
import type { MatchRepository } from "@/infrastructure/repositories/contracts";

const MODEL_VERSION = "poisson-v1";

export class PrismaMatchRepository implements MatchRepository {
  async getUpcoming(variant?: GameVariant): Promise<MatchInput[]> {
    return this.getPersistedMatches(variant);
  }

  async getRoundHistory(variant?: GameVariant): Promise<Array<{
    roundCode: string;
    syncedAt: Date;
    matchesCount: number;
  }>> {
    const jobs = await prisma.syncJob.findMany({
      where: variant
        ? {
            roundCode: {
              startsWith: `round-${variant.toLowerCase()}-`,
            },
          }
        : {
            roundCode: {
              startsWith: "round-",
            },
          },
      orderBy: { syncedAt: "desc" },
      take: 15,
      select: {
        roundCode: true,
        syncedAt: true,
        matchesCount: true,
      },
    });

    return jobs;
  }

  async savePredictions(predictions: MatchPrediction[]): Promise<void> {
    const roundCode = `manual-${new Date().toISOString()}`;
    await prisma.$transaction(
      predictions.map((prediction) =>
        prisma.prediction.create({
          data: {
            matchId: prediction.matchId,
            roundCode,
            modelVersion: MODEL_VERSION,
            recommendedScore: prediction.recommendedScore,
            safeScore: prediction.strategyPicks[StrategyType.SAFE],
            balancedScore: prediction.strategyPicks[StrategyType.BALANCED],
            aggressiveScore: prediction.strategyPicks[StrategyType.AGGRESSIVE],
          },
        }),
      ),
    );
  }

  async saveRoundData(input: {
    roundCode: string;
    matches: MatchInput[];
    predictions: MatchPrediction[];
    syncedAt: Date;
  }): Promise<void> {
    const matchIdMap = new Map<string, string>();

    await prisma.$transaction(async (tx) => {
      for (const match of input.matches) {
        const competition = await tx.competition.upsert({
          where: { code: `${match.variant}-${slugify(match.competition)}` },
          create: {
            code: `${match.variant}-${slugify(match.competition)}`,
            name: match.competition,
            gameVariant: match.variant as unknown as PrismaGameVariant,
          },
          update: {
            name: match.competition,
          },
        });

        const homeTeam = await findOrCreateTeam(tx, match.homeTeam, `api-${match.homeTeam}`);
        const awayTeam = await findOrCreateTeam(tx, match.awayTeam, `api-${match.awayTeam}`);

        const existingMatch = await tx.match.findFirst({
          where: {
            OR: [{ externalId: match.id }],
          },
        });

        const persistedMatch = existingMatch
          ? await tx.match.update({
              where: { id: existingMatch.id },
              data: {
                competitionId: competition.id,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                kickoffUtc: new Date(match.kickOffUtc),
              },
            })
          : await tx.match.create({
              data: {
                externalId: match.id,
                competitionId: competition.id,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                kickoffUtc: new Date(match.kickOffUtc),
              },
            });

        matchIdMap.set(match.id, persistedMatch.id);

        await tx.oddsSnapshot.create({
          data: {
            matchId: persistedMatch.id,
            roundCode: input.roundCode,
            capturedAt: input.syncedAt,
            oneXTwoHome: match.oneXTwoOdds.home,
            oneXTwoDraw: match.oneXTwoOdds.draw,
            oneXTwoAway: match.oneXTwoOdds.away,
            over25: match.over25Odds,
            under25: match.under25Odds,
            bttsYes: match.bttsYesOdds,
            bttsNo: match.bttsNoOdds,
          },
        });
      }

      for (const prediction of input.predictions) {
        const persistedMatchId = matchIdMap.get(prediction.matchId);
        if (!persistedMatchId) {
          continue;
        }

        await tx.prediction.create({
          data: {
            matchId: persistedMatchId,
            roundCode: input.roundCode,
            modelVersion: MODEL_VERSION,
            recommendedScore: prediction.recommendedScore,
            safeScore: prediction.strategyPicks[StrategyType.SAFE],
            balancedScore: prediction.strategyPicks[StrategyType.BALANCED],
            aggressiveScore: prediction.strategyPicks[StrategyType.AGGRESSIVE],
          },
        });
      }

      await tx.syncJob.create({
        data: {
          roundCode: input.roundCode,
          source: "local-sync",
          syncedAt: input.syncedAt,
          matchesCount: input.matches.length,
          playersCount: 0,
          predictionsCount: input.predictions.length,
          notes: "Local sync run",
        },
      });
    }, { timeout: 45_000, maxWait: 10_000 });
  }

  async getPersistedMatches(variant?: GameVariant, roundCode?: string): Promise<MatchInput[]> {
    const selectedRoundCode = roundCode ?? (await getLatestMatchRoundCode(variant));

    if (!selectedRoundCode) {
      return [];
    }

    const rows = await prisma.match.findMany({
      where: {
        oddsSnapshots: {
          some: {
            roundCode: selectedRoundCode,
          },
        },
        ...(variant ? { competition: { gameVariant: variant as unknown as PrismaGameVariant } } : {}),
      },
      include: {
        competition: true,
        homeTeam: true,
        awayTeam: true,
        oddsSnapshots: {
          where: {
            roundCode: selectedRoundCode,
          },
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { kickoffUtc: "asc" },
      take: 120,
    });

    return rows
      .filter((row) => row.oddsSnapshots.length > 0)
      .map((row) => {
        const odds = row.oddsSnapshots[0];
        return {
          id: row.externalId ?? row.id,
          variant: row.competition.gameVariant as unknown as GameVariant,
          competition: row.competition.name,
          kickOffUtc: row.kickoffUtc.toISOString(),
          homeTeam: row.homeTeam.name,
          awayTeam: row.awayTeam.name,
          oneXTwoOdds: {
            home: odds.oneXTwoHome,
            draw: odds.oneXTwoDraw,
            away: odds.oneXTwoAway,
          },
          over25Odds: odds.over25 ?? undefined,
          under25Odds: odds.under25 ?? undefined,
          bttsYesOdds: odds.bttsYes ?? undefined,
          bttsNoOdds: odds.bttsNo ?? undefined,
        } satisfies MatchInput;
      });
  }

  async getLastSyncAt(variant?: GameVariant): Promise<Date | null> {
    if (!variant) {
      const lastSync = await prisma.syncJob.findFirst({
        orderBy: { syncedAt: "desc" },
      });

      return lastSync?.syncedAt ?? null;
    }

    const latestSnapshot = await prisma.oddsSnapshot.findFirst({
      where: {
        match: {
          competition: {
            gameVariant: variant as unknown as PrismaGameVariant,
          },
        },
      },
      orderBy: { capturedAt: "desc" },
    });

    return latestSnapshot?.capturedAt ?? null;
  }
}

async function getLatestMatchRoundCode(variant?: GameVariant): Promise<string | null> {
  const snapshot = await prisma.oddsSnapshot.findFirst({
    where: variant
      ? {
          match: {
            competition: {
              gameVariant: variant as unknown as PrismaGameVariant,
            },
          },
        }
      : undefined,
    orderBy: { capturedAt: "desc" },
    select: { roundCode: true },
  });

  return snapshot?.roundCode ?? null;
}

async function findOrCreateTeam(
  tx: Prisma.TransactionClient,
  teamName: string,
  externalId?: string,
) {
  const existing = await tx.team.findFirst({
    where: { name: teamName },
  });

  if (existing) {
    return existing;
  }

  return tx.team.create({
    data: {
      name: teamName,
      externalId,
    },
  });
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
