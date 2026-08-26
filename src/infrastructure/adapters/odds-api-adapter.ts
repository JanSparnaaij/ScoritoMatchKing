import { env } from "@/config/env";
import { GameVariant } from "@/domain/enums";
import type { MatchInput } from "@/domain/types";
import { ApiFootballAdapter } from "@/infrastructure/adapters/api-football-adapter";
import type { MatchDataProvider, OddsDataProvider, SyncScope } from "@/infrastructure/adapters/contracts";

type OneXTwo = {
  home: number;
  draw: number;
  away: number;
};

type CachedEvent = {
  id: string;
  sportKey: string;
  sportTitle: string;
  variant: GameVariant;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  oneXTwo: OneXTwo;
  over25Odds: number | undefined;
  under25Odds: number | undefined;
  bttsYesOdds: number | undefined;
  bttsNoOdds: number | undefined;
};

type SportConfig = {
  sportKey: string;
  title: string;
  variant: GameVariant;
};

const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; payload: unknown }>();

export class OddsApiQuotaError extends Error {
  constructor(message = "Odds API maandelijkse quota (500) is bereikt. Wacht tot je monthly reset of upgrade je plan.") {
    super(message);
    this.name = "OddsApiQuotaError";
  }
}

export class OddsApiAdapter implements MatchDataProvider, OddsDataProvider {
  private cachedEvents = new Map<string, CachedEvent>();
  private readonly apiFootballAdapter = new ApiFootballAdapter();
  private readonly fallbackOddsByMatchId = new Map<string, OneXTwo>();

  async getUpcomingMatches(scope?: SyncScope): Promise<MatchInput[]> {
    let events = await this.loadCurrentRoundEvents(scope);

    if (events.length === 0 && scope?.variant === GameVariant.KKD) {
      const fallbackMatches = await this.apiFootballAdapter.getUpcomingMatches({ variant: GameVariant.KKD });
      this.fallbackOddsByMatchId.clear();

      events = fallbackMatches.map((match) => {
        this.fallbackOddsByMatchId.set(match.id, match.oneXTwoOdds);

        return {
          id: match.id,
          sportKey: "soccer_netherlands_eerste_divisie_api_football",
          sportTitle: match.competition,
          variant: GameVariant.KKD,
          commenceTime: match.kickOffUtc,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          oneXTwo: match.oneXTwoOdds,
          over25Odds: match.over25Odds,
          under25Odds: match.under25Odds,
          bttsYesOdds: match.bttsYesOdds,
          bttsNoOdds: match.bttsNoOdds,
        } satisfies CachedEvent;
      });

      this.cachedEvents = new Map(events.map((event) => [event.id, event]));
    }

    return events.map((event) => ({
      id: event.id,
      variant: event.variant,
      competition: event.sportTitle,
      kickOffUtc: event.commenceTime,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam,
      oneXTwoOdds: event.oneXTwo,
      over25Odds: event.over25Odds,
      under25Odds: event.under25Odds,
      bttsYesOdds: event.bttsYesOdds,
      bttsNoOdds: event.bttsNoOdds,
    }));
  }

  async getLatestOdds(matchIds: string[], scope?: SyncScope) {
    if (!env.ENABLE_EXTERNAL_SYNC) {
      throw new Error("ENABLE_EXTERNAL_SYNC staat uit");
    }

    if (!env.ODDS_API_KEY) {
      throw new Error("ODDS_API_KEY ontbreekt voor odds ophalen");
    }

    if (this.cachedEvents.size === 0) {
      await this.loadCurrentRoundEvents(scope);
    }

    return matchIds
      .map((matchId) => {
        const event = this.cachedEvents.get(matchId);
        const fallbackOdds = this.fallbackOddsByMatchId.get(matchId);
        if (!event) {
          return fallbackOdds
            ? {
                matchId,
                oneXTwo: fallbackOdds,
              }
            : null;
        }

        return {
          matchId,
          oneXTwo: event.oneXTwo,
        };
      })
      .filter((entry): entry is { matchId: string; oneXTwo: OneXTwo } => entry !== null);
  }

  private async loadCurrentRoundEvents(scope?: SyncScope): Promise<CachedEvent[]> {
    if (!env.ENABLE_EXTERNAL_SYNC) {
      throw new Error("ENABLE_EXTERNAL_SYNC staat uit");
    }

    if (!env.ODDS_API_KEY) {
      throw new Error("ODDS_API_KEY ontbreekt");
    }

    const scopedConfigs = scope?.variant
      ? SPORT_CONFIGS.filter((config) => config.variant === scope.variant)
      : SPORT_CONFIGS;

    const selectedEvents = (await Promise.all(scopedConfigs.map(async (config) => {
      try {
        return await this.loadSportEvents(config);
      } catch (error) {
        if (error instanceof OddsApiQuotaError) {
          throw error;
        }
        return [];
      }
    }))).flat();

    this.cachedEvents = new Map(selectedEvents.map((event) => [event.id, event]));
    return selectedEvents;
  }

  private async loadSportEvents(config: SportConfig): Promise<CachedEvent[]> {
    const payload = await requestSportOdds(config.sportKey);

    const candidates = payload
      .map((event) => {
        const marketSnapshot = extractMarketSnapshot(event.bookmakers ?? [], event.home_team, event.away_team);
        const oneXTwo = marketSnapshot.oneXTwo;
        if (!oneXTwo) {
          return null;
        }

        return {
          id: event.id,
          sportKey: config.sportKey,
          sportTitle: config.title,
          variant: config.variant,
          commenceTime: event.commence_time,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          oneXTwo,
          over25Odds: marketSnapshot.over25Odds,
          under25Odds: marketSnapshot.under25Odds,
          bttsYesOdds: marketSnapshot.bttsYesOdds,
          bttsNoOdds: marketSnapshot.bttsNoOdds,
        } satisfies CachedEvent;
      })
      .filter((entry): entry is CachedEvent => entry !== null);

    const mapped = candidates.sort((left, right) => Date.parse(left.commenceTime) - Date.parse(right.commenceTime));

    return selectUpcomingRounds(mapped, 2);
  }
}

async function requestSportOdds(sportKey: string) {
  try {
    return await requestOddsApi<Array<{
      id: string;
      sport_key: string;
      commence_time: string;
      home_team: string;
      away_team: string;
      bookmakers?: Array<{
        markets?: Array<{
          key?: string;
          outcomes?: Array<{ name?: string; price?: number; point?: number }>;
        }>;
      }>;
    }>>(`/sports/${sportKey}/odds/?regions=eu&markets=h2h,totals,btts&oddsFormat=decimal&apiKey=${encodeURIComponent(env.ODDS_API_KEY)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("(422)")) {
      throw error;
    }

    return requestOddsApi<Array<{
      id: string;
      sport_key: string;
      commence_time: string;
      home_team: string;
      away_team: string;
      bookmakers?: Array<{
        markets?: Array<{
          key?: string;
          outcomes?: Array<{ name?: string; price?: number; point?: number }>;
        }>;
      }>;
    }>>(`/sports/${sportKey}/odds/?regions=eu&markets=h2h&oddsFormat=decimal&apiKey=${encodeURIComponent(env.ODDS_API_KEY)}`);
  }
}

function extractOneXTwoOdds(
  bookmakers: Array<{
    markets?: Array<{
      key?: string;
      outcomes?: Array<{ name?: string; price?: number; point?: number }>;
    }>;
  }>,
  homeTeam: string,
  awayTeam: string,
): OneXTwo | null {
  const homePrices: number[] = [];
  const drawPrices: number[] = [];
  const awayPrices: number[] = [];

  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets?.find((entry) => entry.key === "h2h" || entry.key === "h2h_3_way");
    const outcomes = market?.outcomes ?? [];
    const home = outcomes.find((entry) => normalizeName(entry.name) === normalizeName(homeTeam))?.price;
    const away = outcomes.find((entry) => normalizeName(entry.name) === normalizeName(awayTeam))?.price;
    const draw = outcomes.find((entry) => normalizeName(entry.name) === "draw")?.price;

    if (typeof home === "number" && home > 1) {
      homePrices.push(home);
    }
    if (typeof draw === "number" && draw > 1) {
      drawPrices.push(draw);
    }
    if (typeof away === "number" && away > 1) {
      awayPrices.push(away);
    }
  }

  if (homePrices.length === 0 || drawPrices.length === 0 || awayPrices.length === 0) {
    return null;
  }

  return {
    home: average(homePrices),
    draw: average(drawPrices),
    away: average(awayPrices),
  };
}

function extractMarketSnapshot(
  bookmakers: Array<{
    markets?: Array<{
      key?: string;
      outcomes?: Array<{ name?: string; price?: number; point?: number }>;
    }>;
  }>,
  homeTeam: string,
  awayTeam: string,
) {
  const oneXTwo = extractOneXTwoOdds(bookmakers, homeTeam, awayTeam);
  const over25Prices: number[] = [];
  const under25Prices: number[] = [];
  const bttsYesPrices: number[] = [];
  const bttsNoPrices: number[] = [];

  for (const bookmaker of bookmakers) {
    for (const market of bookmaker.markets ?? []) {
      if (market.key === "totals") {
        const outcomes = (market.outcomes ?? []).filter((entry) => entry.point === 2.5);
        const over = outcomes.find((entry) => normalizeName(entry.name) === "over")?.price;
        const under = outcomes.find((entry) => normalizeName(entry.name) === "under")?.price;

        if (typeof over === "number" && over > 1) {
          over25Prices.push(over);
        }
        if (typeof under === "number" && under > 1) {
          under25Prices.push(under);
        }
      }

      if (market.key === "btts") {
        const yes = (market.outcomes ?? []).find((entry) => normalizeName(entry.name) === "yes")?.price;
        const no = (market.outcomes ?? []).find((entry) => normalizeName(entry.name) === "no")?.price;

        if (typeof yes === "number" && yes > 1) {
          bttsYesPrices.push(yes);
        }
        if (typeof no === "number" && no > 1) {
          bttsNoPrices.push(no);
        }
      }
    }
  }

  return {
    oneXTwo,
    over25Odds: over25Prices.length > 0 ? average(over25Prices) : undefined,
    under25Odds: under25Prices.length > 0 ? average(under25Prices) : undefined,
    bttsYesOdds: bttsYesPrices.length > 0 ? average(bttsYesPrices) : undefined,
    bttsNoOdds: bttsNoPrices.length > 0 ? average(bttsNoPrices) : undefined,
  };
}

function selectUpcomingRounds(events: CachedEvent[], maxRounds: number): CachedEvent[] {
  if (events.length === 0) {
    return [];
  }

  const sorted = [...events].sort((left, right) => Date.parse(left.commenceTime) - Date.parse(right.commenceTime));
  const groupedRounds: CachedEvent[][] = [];
  let currentRound: CachedEvent[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const previousKickoff = Date.parse(sorted[index - 1].commenceTime);
    const nextKickoff = Date.parse(sorted[index].commenceTime);
    const hourGap = (nextKickoff - previousKickoff) / (1000 * 60 * 60);

    if (hourGap > 72) {
      groupedRounds.push(currentRound);
      currentRound = [sorted[index]];
      continue;
    }

    currentRound.push(sorted[index]);
  }

  groupedRounds.push(currentRound);
  return groupedRounds.slice(0, maxRounds).flat();
}

async function requestOddsApi<T>(path: string): Promise<T> {
  const cacheKey = path.replace(/([?&])apiKey=[^&]+/, "$1apiKey=<redacted>");
  const now = Date.now();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.payload as T;
  }

  const response = await fetch(`${env.ODDS_API_BASE_URL}${path}`);

  const remaining = response.headers.get("x-requests-remaining");
  const used = response.headers.get("x-requests-used");
  if (remaining !== null || used !== null) {
    console.log(`[odds-api] ${response.status} remaining=${remaining ?? "?"} used=${used ?? "?"} ${cacheKey}`);
  }

  if (response.status === 401) {
    throw new OddsApiQuotaError();
  }

  if (!response.ok) {
    throw new Error(`The Odds API request failed for ${path} (${response.status})`);
  }

  const payload = (await response.json()) as { message?: string; error_code?: string } & T;
  if (payload && typeof payload === "object" && "error_code" in payload && payload.error_code) {
    throw new Error(payload.message ?? payload.error_code);
  }

  responseCache.set(cacheKey, { expiresAt: now + RESPONSE_CACHE_TTL_MS, payload });
  return payload as T;
}

function average(values: number[]): number {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function normalizeName(value?: string): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const SPORT_CONFIGS: SportConfig[] = [
  {
    sportKey: "soccer_netherlands_eredivisie",
    title: "Eredivisie",
    variant: GameVariant.NL,
  },
  {
    sportKey: "soccer_netherlands_eerste_divisie",
    title: "Keuken Kampioen Divisie",
    variant: GameVariant.KKD,
  },
  {
    sportKey: "soccer_belgium_first_div",
    title: "Belgische Eerste Klasse A",
    variant: GameVariant.BE,
  },
  {
    sportKey: "soccer_spain_la_liga",
    title: "La Liga",
    variant: GameVariant.INT,
  },
  {
    sportKey: "soccer_spain_segunda_division",
    title: "La Liga 2",
    variant: GameVariant.INT,
  },
  {
    sportKey: "soccer_epl",
    title: "Premier League",
    variant: GameVariant.INT,
  },
  {
    sportKey: "soccer_germany_bundesliga",
    title: "Bundesliga",
    variant: GameVariant.INT,
  },
  {
    sportKey: "soccer_france_ligue_one",
    title: "Ligue 1",
    variant: GameVariant.INT,
  },
  {
    sportKey: "soccer_italy_serie_a",
    title: "Serie A",
    variant: GameVariant.INT,
  },
  {
    sportKey: "soccer_uefa_champs_league",
    title: "Champions League",
    variant: GameVariant.EUR,
  },
  {
    sportKey: "soccer_uefa_champs_league_qualification",
    title: "Champions League kwalificatie",
    variant: GameVariant.EUR,
  },
  {
    sportKey: "soccer_uefa_europa_league",
    title: "Europa League",
    variant: GameVariant.EUR,
  },
  {
    sportKey: "soccer_uefa_europa_conference_league",
    title: "Conference League",
    variant: GameVariant.EUR,
  },
  {
    sportKey: "soccer_uefa_nations_league",
    title: "UEFA Nations League",
    variant: GameVariant.INTERLANDS,
  },
  {
    sportKey: "soccer_fifa_world_cup_qualifiers_europe",
    title: "WK-kwalificatie (UEFA)",
    variant: GameVariant.INTERLANDS,
  },
  {
    sportKey: "soccer_uefa_european_championship_qualification",
    title: "EK-kwalificatie",
    variant: GameVariant.INTERLANDS,
  },
  {
    sportKey: "soccer_uefa_european_championship",
    title: "EK eindronde",
    variant: GameVariant.INTERLANDS,
  },
  {
    sportKey: "soccer_fifa_world_cup",
    title: "WK eindronde",
    variant: GameVariant.INTERLANDS,
  },
];
