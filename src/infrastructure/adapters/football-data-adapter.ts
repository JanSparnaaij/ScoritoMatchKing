import { fixtureMatches } from "@/application/fixtures/match-fixtures";
import { env } from "@/config/env";
import type { MatchInput } from "@/domain/types";
import type { MatchDataProvider } from "@/infrastructure/adapters/contracts";

export class FootballDataAdapter implements MatchDataProvider {
  async getUpcomingMatches(): Promise<MatchInput[]> {
    if (!env.ENABLE_EXTERNAL_SYNC || !env.FOOTBALL_DATA_API_KEY) {
      return fixtureMatches;
    }

    return fixtureMatches;
  }
}
