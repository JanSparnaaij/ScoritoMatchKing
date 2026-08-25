import { GameVariant } from "@/domain/enums";
import type { MatchInput } from "@/domain/types";

export type SyncScope = {
  variant?: GameVariant;
};

export interface MatchDataProvider {
  getUpcomingMatches(scope?: SyncScope): Promise<MatchInput[]>;
}

export interface OddsDataProvider {
  getLatestOdds(matchIds: string[], scope?: SyncScope): Promise<Array<{ matchId: string; oneXTwo: { home: number; draw: number; away: number } }>>;
}
