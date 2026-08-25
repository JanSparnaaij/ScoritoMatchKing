import { GameVariant } from "@/domain/enums";
import type { MatchInput, MatchPrediction } from "@/domain/types";

export interface MatchRepository {
  getUpcoming(variant?: GameVariant): Promise<MatchInput[]>;
  savePredictions(predictions: MatchPrediction[]): Promise<void>;
  saveRoundData(input: {
    roundCode: string;
    matches: MatchInput[];
    predictions: MatchPrediction[];
    syncedAt: Date;
  }): Promise<void>;
  getPersistedMatches(variant?: GameVariant, roundCode?: string): Promise<MatchInput[]>;
  getLastSyncAt(variant?: GameVariant): Promise<Date | null>;
  getRoundHistory(variant?: GameVariant): Promise<Array<{
    roundCode: string;
    syncedAt: Date;
    matchesCount: number;
  }>>;
}
