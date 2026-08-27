import { env } from "@/config/env";
import { GameVariant } from "@/domain/enums";
import type { MatchInput } from "@/domain/types";
import type { MatchDataProvider, SyncScope } from "@/infrastructure/adapters/contracts";

export class ApiFootballAdapter implements MatchDataProvider {
  async getUpcomingMatches(scope?: SyncScope): Promise<MatchInput[]> {
    if (!env.ENABLE_EXTERNAL_SYNC) {
      throw new Error("ENABLE_EXTERNAL_SYNC staat uit");
    }

    if (!env.API_FOOTBALL_KEY) {
      throw new Error("API_FOOTBALL_KEY ontbreekt");
    }

    const matches = await fetchDateWindowFixturesWithOdds(scope);
    if (matches.length === 0) {
      throw new Error("Geen fixtures met 1X2 odds beschikbaar uit API-Football (Free-tier 3-daagse window)");
    }

    return matches;
  }
}

const API_FOOTBALL_MAX_CALLS_PER_SYNC = 8;
const API_FOOTBALL_MIN_INTERVAL_MS = 6_500;

async function fetchDateWindowFixturesWithOdds(scope?: SyncScope): Promise<MatchInput[]> {
  const today = new Date();
  const dates = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  const matches: MatchInput[] = [];
  let callsUsed = 0;
  let lastCallAt = 0;

  outer: for (const date of dates) {
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      if (callsUsed >= API_FOOTBALL_MAX_CALLS_PER_SYNC) {
        break outer;
      }

      const wait = API_FOOTBALL_MIN_INTERVAL_MS - (Date.now() - lastCallAt);
      if (lastCallAt > 0 && wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }

      let payload: OddsBulkPayload;
      try {
        payload = await requestApiFootball<OddsBulkPayload>(`/odds?date=${date}&page=${page}`);
      } catch {
        break;
      }
      callsUsed += 1;
      lastCallAt = Date.now();

      totalPages = payload.paging?.total ?? 1;

      for (const entry of payload.response ?? []) {
        const leagueId = entry.league?.id;
        if (typeof leagueId !== "number") continue;

        const variant = LEAGUE_ID_TO_VARIANT[leagueId];
        if (!variant) continue;
        if (scope?.variant && variant !== scope.variant) continue;

        const odds = extractOneXTwoFromApiFootballBookmakers(entry.bookmakers ?? []);
        if (!odds) continue;

        matches.push({
          id: String(entry.fixture?.id ?? ""),
          variant,
          competition: entry.league?.name ?? "onbekend",
          kickOffUtc: entry.fixture?.date ?? new Date().toISOString(),
          homeTeam: entry.teams?.home?.name ?? "?",
          awayTeam: entry.teams?.away?.name ?? "?",
          oneXTwoOdds: odds,
        });
      }

      page += 1;
    }
  }

  return dedupeMatchesById(matches);
}

type OddsBulkPayload = {
  response?: Array<{
    fixture?: { id?: number; date?: string };
    league?: { id?: number; name?: string };
    teams?: { home?: { name?: string }; away?: { name?: string } };
    bookmakers?: Array<{
      bets?: Array<{
        name?: string;
        values?: Array<{ value?: string; odd?: string }>;
      }>;
    }>;
  }>;
  paging?: { current?: number; total?: number };
};

function extractOneXTwoFromApiFootballBookmakers(
  bookmakers: NonNullable<OddsBulkPayload["response"]>[number]["bookmakers"],
): { home: number; draw: number; away: number } | null {
  const homePrices: number[] = [];
  const drawPrices: number[] = [];
  const awayPrices: number[] = [];

  for (const bookmaker of bookmakers ?? []) {
    const market = bookmaker.bets?.find((bet) => (bet.name ?? "").toLowerCase().includes("match winner"));
    if (!market || !market.values) continue;

    const home = market.values.find((v) => (v.value ?? "").toLowerCase() === "home")?.odd;
    const draw = market.values.find((v) => (v.value ?? "").toLowerCase() === "draw")?.odd;
    const away = market.values.find((v) => (v.value ?? "").toLowerCase() === "away")?.odd;

    const h = Number(home);
    const d = Number(draw);
    const a = Number(away);
    if (h > 1 && d > 1 && a > 1) {
      homePrices.push(h);
      drawPrices.push(d);
      awayPrices.push(a);
    }
  }

  if (homePrices.length === 0) return null;
  const avg = (arr: number[]) => Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2));
  return { home: avg(homePrices), draw: avg(drawPrices), away: avg(awayPrices) };
}

function dedupeMatchesById(matches: MatchInput[]): MatchInput[] {
  const map = new Map<string, MatchInput>();
  for (const m of matches) {
    if (!map.has(m.id)) {
      map.set(m.id, m);
    }
  }
  return [...map.values()].sort((a, b) => Date.parse(a.kickOffUtc) - Date.parse(b.kickOffUtc));
}

async function requestApiFootball<T>(path: string): Promise<T> {
  const url = `${env.API_FOOTBALL_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      "x-apisports-key": env.API_FOOTBALL_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed for ${path}`);
  }

  const payload = (await response.json()) as T & {
    errors?: Record<string, string>;
  };

  const apiErrors = payload.errors ?? {};
  const firstError = Object.values(apiErrors).find((value) => typeof value === "string" && value.length > 0);
  if (firstError) {
    throw new Error(firstError);
  }

  return payload as T;
}

const LEAGUE_ID_TO_VARIANT: Record<number, GameVariant> = {
  // NL
  88: GameVariant.NL,             // Eredivisie
  // KKD
  89: GameVariant.KKD,            // Eerste Divisie
  // BE
  144: GameVariant.BE,            // Jupiler Pro League
  // INT (top-5 Europese club-competities)
  39: GameVariant.INT,             // Premier League (Engeland)
  140: GameVariant.INT,            // La Liga (Spanje)
  141: GameVariant.INT,            // La Liga 2 / Segunda (Spanje)
  78: GameVariant.INT,             // Bundesliga (Duitsland)
  61: GameVariant.INT,             // Ligue 1 (Frankrijk)
  135: GameVariant.INT,            // Serie A (Italië)
  // EUR (Europese club-cups)
  2: GameVariant.EUR,              // UEFA Champions League
  3: GameVariant.EUR,              // UEFA Europa League
  848: GameVariant.EUR,            // UEFA Europa Conference League
  // INTERLANDS (landenteams)
  5: GameVariant.INTERLANDS,       // UEFA Nations League
  1: GameVariant.INTERLANDS,       // FIFA World Cup
  32: GameVariant.INTERLANDS,      // World Cup Qualifier Europe
  4: GameVariant.INTERLANDS,       // UEFA European Championship
  960: GameVariant.INTERLANDS,     // Euro Championship Qualification
};
