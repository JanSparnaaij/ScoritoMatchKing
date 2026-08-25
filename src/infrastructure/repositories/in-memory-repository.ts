import { fixtureMatches } from "@/application/fixtures/match-fixtures";
import { GameVariant } from "@/domain/enums";
import type { MatchInput, MatchPrediction } from "@/domain/types";
import type { MatchRepository } from "@/infrastructure/repositories/contracts";

export class InMemoryMatchRepository implements MatchRepository {
  private readonly predictions: MatchPrediction[] = [];
  private lastSyncAt: Date | null = null;

  async getUpcoming(variant?: GameVariant): Promise<MatchInput[]> {
    return variant ? fixtureMatches.filter((match) => match.variant === variant) : fixtureMatches;
  }

  async savePredictions(predictions: MatchPrediction[]): Promise<void> {
    this.predictions.splice(0, this.predictions.length, ...predictions);
  }

  async saveRoundData(input: {
    roundCode: string;
    matches: MatchInput[];
    predictions: MatchPrediction[];
    syncedAt: Date;
  }): Promise<void> {
    this.predictions.splice(0, this.predictions.length, ...input.predictions);
    this.lastSyncAt = input.syncedAt;
  }

  async getPersistedMatches(variant?: GameVariant, _roundCode?: string): Promise<MatchInput[]> {
    return variant ? fixtureMatches.filter((match) => match.variant === variant) : fixtureMatches;
  }

  async getRoundHistory(_variant?: GameVariant): Promise<Array<{
    roundCode: string;
    syncedAt: Date;
    matchesCount: number;
  }>> {
    return [
      {
        roundCode: "fixture-round-1",
        syncedAt: this.lastSyncAt ?? new Date(),
        matchesCount: fixtureMatches.length,
      },
    ];
  }

  async getLastSyncAt(): Promise<Date | null> {
    return this.lastSyncAt;
  }
}
