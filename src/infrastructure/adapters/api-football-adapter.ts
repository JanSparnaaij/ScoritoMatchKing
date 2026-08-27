import { env } from "@/config/env";
import { GameVariant } from "@/domain/enums";
import type { MatchInput } from "@/domain/types";
import type { MatchDataProvider, SyncScope } from "@/infrastructure/adapters/contracts";

type ApiFixtureRow = {
  fixture: { id: number; date: string };
  league: { id: number; name: string; season: number; round?: string };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  variant: GameVariant;
};

type TargetLeague = {
  variant: GameVariant;
  leagueId: number;
  leagueName: string;
  season: number;
};

export class ApiFootballAdapter implements MatchDataProvider {
  async getUpcomingMatches(scope?: SyncScope): Promise<MatchInput[]> {
    if (!env.ENABLE_EXTERNAL_SYNC) {
      throw new Error("ENABLE_EXTERNAL_SYNC staat uit");
    }

    if (!env.API_FOOTBALL_KEY) {
      throw new Error("API_FOOTBALL_KEY ontbreekt");
    }

    const rawMatches = await fetchRoundScopedFixtures(scope);

    const capped = rawMatches
      .slice()
      .sort((a, b) => Date.parse(a.fixture.date) - Date.parse(b.fixture.date))
      .slice(0, API_FOOTBALL_FIXTURE_LIMIT);

    const oddsMap = new Map<string, { home: number; draw: number; away: number }>();
    for (const item of capped) {
      try {
        const odds = await fetchOneXTwoOddsFromApiFootball(item.fixture.id);
        if (odds) {
          oddsMap.set(String(item.fixture.id), odds);
        }
      } catch {
        // Skip fixtures without odds; continue with the rest.
      }
    }

    const matches = capped
      .map((item) => {
        const odds = oddsMap.get(String(item.fixture.id));
        if (!odds) {
          return null;
        }

        return {
          id: String(item.fixture.id),
          variant: item.variant,
          competition: `${item.league.name}${item.league.round ? ` (${item.league.round})` : ""}`,
          kickOffUtc: item.fixture.date,
          homeTeam: item.teams.home.name,
          awayTeam: item.teams.away.name,
          oneXTwoOdds: odds,
        } satisfies MatchInput;
      })
      .filter((entry): entry is MatchInput => entry !== null)
      .filter((entry) => (scope?.variant ? entry.variant === scope.variant : true));

    if (matches.length === 0) {
      throw new Error("Geen fixtures met 1X2 odds beschikbaar uit API-Football");
    }

    return matches;
  }
}

const API_FOOTBALL_FIXTURE_LIMIT = 6;

async function fetchOneXTwoOddsFromApiFootball(fixtureId: number) {
  const payload = await requestApiFootball<{
    response?: Array<{
      bookmakers?: Array<{
        bets?: Array<{
          name?: string;
          values?: Array<{ value?: string; odd?: string }>;
        }>;
      }>;
    }>;
  }>(`/odds?fixture=${fixtureId}`);

  const first = payload.response?.[0];
  const bookmakers = first?.bookmakers ?? [];

  for (const bookmaker of bookmakers) {
    const market = bookmaker.bets?.find((bet) => (bet.name ?? "").toLowerCase().includes("match winner"));
    if (!market || !market.values) {
      continue;
    }

    const home = market.values.find((entry) => (entry.value ?? "").toLowerCase() === "home")?.odd;
    const draw = market.values.find((entry) => (entry.value ?? "").toLowerCase() === "draw")?.odd;
    const away = market.values.find((entry) => (entry.value ?? "").toLowerCase() === "away")?.odd;

    if (home && draw && away) {
      return {
        home: Number(home),
        draw: Number(draw),
        away: Number(away),
      };
    }
  }

  return null;
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

async function fetchRoundScopedFixtures(scope?: SyncScope): Promise<ApiFixtureRow[]> {
  const today = new Date();
  const dates = [0, 1, 2].map((offset) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  const payloads = await Promise.all(
    dates.map((date) =>
      requestApiFootball<{
        response?: Array<{
          fixture: { id: number; date: string };
          league: { id: number; name: string; season: number; round?: string };
          teams: {
            home: { name: string };
            away: { name: string };
          };
        }>;
      }>(`/fixtures?date=${date}`).catch(() => ({ response: [] })),
    ),
  );

  const rawRows = payloads.flatMap((payload) => payload.response ?? []);

  const annotated: ApiFixtureRow[] = rawRows
    .map((row) => {
      const variant = detectVariant(row.league.name);
      if (!variant) {
        return null;
      }
      return { ...row, variant } satisfies ApiFixtureRow;
    })
    .filter((entry): entry is ApiFixtureRow => entry !== null);

  const filtered = scope?.variant ? annotated.filter((entry) => entry.variant === scope.variant) : annotated;

  const deduped = dedupeFixtures(filtered);
  if (deduped.length === 0) {
    throw new Error("Geen fixtures gevonden binnen 3-daagse window voor de gekozen varianten (Free-tier limiet API-Football)");
  }

  return deduped;
}

async function resolveTargetLeagues(scope?: SyncScope): Promise<TargetLeague[]> {
  const selectedSearches = scope?.variant
    ? TARGET_LEAGUE_SEARCHES.filter((entry) => entry.variant === scope.variant)
    : TARGET_LEAGUE_SEARCHES;

  const resolved = await Promise.all(
    selectedSearches.map(async (target) => {
      for (const query of target.queries) {
        const league = await resolveLeagueBySearch(target.variant, query);
        if (league) {
          return league;
        }
      }

      return null;
    }),
  );

  return resolved.filter((entry): entry is TargetLeague => entry !== null);
}

async function resolveLeagueBySearch(variant: GameVariant, query: string): Promise<TargetLeague | null> {
  const payload = await requestApiFootball<{
    response?: Array<{
      league: { id: number; name: string };
      seasons?: Array<{ year: number; current?: boolean }>;
    }>;
  }>(`/leagues?search=${encodeURIComponent(query)}`);

  const candidates = (payload.response ?? [])
    .map((entry) => {
      const season = pickSeason(entry.seasons ?? []);
      if (!season) {
        return null;
      }

      return {
        variant,
        leagueId: entry.league.id,
        leagueName: entry.league.name,
        season,
      } satisfies TargetLeague;
    })
    .filter((entry): entry is TargetLeague => entry !== null);

  if (candidates.length === 0) {
    return null;
  }

  const exact = candidates.find((entry) => normalizeLabel(entry.leagueName) === normalizeLabel(query));
  return exact ?? candidates[0];
}

function pickSeason(seasons: Array<{ year: number; current?: boolean }>): number | null {
  if (seasons.length === 0) {
    return null;
  }

  const current = seasons.find((season) => season.current);
  if (current) {
    return current.year;
  }

  return [...seasons].sort((left, right) => right.year - left.year)[0]?.year ?? null;
}

async function fetchFixturesForLeague(targetLeague: TargetLeague): Promise<ApiFixtureRow[]> {
  for (const season of uniqueSeasons([targetLeague.season, targetLeague.season + 1, targetLeague.season - 1, 2024, 2023, 2022])) {
    let payload: {
      response?: Array<{
        fixture: { id: number; date: string };
        league: { id: number; name: string; season: number; round?: string };
        teams: {
          home: { name: string };
          away: { name: string };
        };
      }>;
    };

    try {
      payload = await requestApiFootball<{
        response?: Array<{
          fixture: { id: number; date: string };
          league: { id: number; name: string; season: number; round?: string };
          teams: {
            home: { name: string };
            away: { name: string };
          };
        }>;
      }>(`/fixtures?league=${targetLeague.leagueId}&season=${season}&next=30`);
    } catch {
      continue;
    }

    const rows = (payload.response ?? []).map((item) => ({
      ...item,
      variant: targetLeague.variant,
    } satisfies ApiFixtureRow));

    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

function uniqueSeasons(seasons: number[]): number[] {
  return [...new Set(seasons.filter((season) => Number.isFinite(season) && season > 0))];
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function selectPrimaryRoundsPerLeague(rows: ApiFixtureRow[]): ApiFixtureRow[] {
  const byLeagueSeason = new Map<string, ApiFixtureRow[]>();

  for (const row of rows) {
    const key = `${row.league.id}-${row.league.season}`;
    const bucket = byLeagueSeason.get(key) ?? [];
    bucket.push(row);
    byLeagueSeason.set(key, bucket);
  }

  const selected: ApiFixtureRow[] = [];

  for (const [, leagueRows] of byLeagueSeason) {
    const byRound = new Map<string, ApiFixtureRow[]>();

    for (const row of leagueRows) {
      const roundKey = row.league.round ?? "onbekend";
      const bucket = byRound.get(roundKey) ?? [];
      bucket.push(row);
      byRound.set(roundKey, bucket);
    }

    let bestRound: ApiFixtureRow[] = [];
    let bestKickoff = Number.MAX_SAFE_INTEGER;
    let bestCount = -1;

    for (const [, roundRows] of byRound) {
      const earliestKickoff = roundRows.reduce((min, row) => {
        const ts = Date.parse(row.fixture.date);
        return Number.isFinite(ts) ? Math.min(min, ts) : min;
      }, Number.MAX_SAFE_INTEGER);

      if (earliestKickoff < bestKickoff || (earliestKickoff === bestKickoff && roundRows.length > bestCount)) {
        bestRound = roundRows;
        bestKickoff = earliestKickoff;
        bestCount = roundRows.length;
      }
    }

    selected.push(...bestRound);
  }

  return selected;
}

function dedupeFixtures(rows: ApiFixtureRow[]): ApiFixtureRow[] {
  const map = new Map<number, ApiFixtureRow>();

  for (const row of rows) {
    map.set(row.fixture.id, row);
  }

  return [...map.values()].sort((a, b) => Date.parse(a.fixture.date) - Date.parse(b.fixture.date));
}

function detectVariant(competitionName: string): GameVariant | null {
  const lower = competitionName.toLowerCase();

  if (NL_COMPETITION_MATCHERS.some((matcher) => lower.includes(matcher))) {
    return GameVariant.NL;
  }

  if (KKD_COMPETITION_MATCHERS.some((matcher) => lower.includes(matcher))) {
    return GameVariant.KKD;
  }

  if (BE_COMPETITION_MATCHERS.some((matcher) => lower.includes(matcher))) {
    return GameVariant.BE;
  }

  if (EUR_COMPETITION_MATCHERS.some((matcher) => lower.includes(matcher))) {
    return GameVariant.EUR;
  }

  if (INTERLANDS_COMPETITION_MATCHERS.some((matcher) => lower.includes(matcher))) {
    return GameVariant.INTERLANDS;
  }

  if (INT_COMPETITION_MATCHERS.some((matcher) => lower.includes(matcher))) {
    return GameVariant.INT;
  }

  return null;
}

const NL_COMPETITION_MATCHERS = ["eredivisie"];

const KKD_COMPETITION_MATCHERS = ["keuken kampioen", "eerste divisie", "eerste divisie a"];

const BE_COMPETITION_MATCHERS = ["pro league", "first division a", "jupiler pro league"];

const INT_COMPETITION_MATCHERS = [
  "premier league",
  "la liga",
  "segunda division",
  "bundesliga",
  "ligue 1",
  "serie a",
];

const EUR_COMPETITION_MATCHERS = [
  "champions league",
  "europa league",
  "conference league",
];

const INTERLANDS_COMPETITION_MATCHERS = [
  "nations league",
  "world cup",
  "euro championship",
  "european championship",
  "wk-kwalificatie",
  "ek-kwalificatie",
  "qualification",
];

const TARGET_LEAGUE_SEARCHES: Array<{ variant: GameVariant; queries: string[] }> = [
  {
    variant: GameVariant.NL,
    queries: ["Eredivisie"],
  },
  {
    variant: GameVariant.KKD,
    queries: ["Eerste Divisie", "Keuken Kampioen Divisie"],
  },
  {
    variant: GameVariant.BE,
    queries: ["Jupiler Pro League", "First Division A", "Pro League"],
  },
  {
    variant: GameVariant.INT,
    queries: [
      "Premier League",
      "La Liga",
      "La Liga 2",
      "Bundesliga",
      "Ligue 1",
      "Serie A",
    ],
  },
  {
    variant: GameVariant.EUR,
    queries: [
      "UEFA Champions League",
      "UEFA Europa League",
      "UEFA Europa Conference League",
    ],
  },
  {
    variant: GameVariant.INTERLANDS,
    queries: [
      "UEFA Nations League",
      "World Cup",
      "World Cup - Qualification Europe",
      "Euro Championship",
      "Euro Championship - Qualification",
    ],
  },
];
