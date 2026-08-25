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

    const oddsRows = await Promise.all(
      rawMatches.map(async (item) => ({
        fixtureId: String(item.fixture.id),
        odds: await fetchOneXTwoOddsFromApiFootball(item.fixture.id),
      })),
    );

    const oddsMap = new Map(oddsRows.map((row) => [row.fixtureId, row.odds]));

    const matches = rawMatches
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
  const targetLeagues = await resolveTargetLeagues(scope);

  const annotated = (await Promise.all(targetLeagues.map((league) => fetchFixturesForLeague(league)))).flat();

  if (annotated.length === 0) {
    throw new Error("Geen fixtures gevonden voor NL/KKD/BE/INT/EUR/INTERLANDS competitie-selectie");
  }

  const variants = scope?.variant
    ? [scope.variant]
    : [GameVariant.NL, GameVariant.KKD, GameVariant.BE, GameVariant.INT, GameVariant.EUR, GameVariant.INTERLANDS];

  const byVariant = variants.flatMap((variant) => {
    const rows = annotated.filter((entry) => entry.variant === variant);
    return selectPrimaryRoundsPerLeague(rows);
  });

  const deduped = dedupeFixtures(byVariant);
  if (deduped.length === 0) {
    throw new Error("Geen ronde-fixtures gevonden voor de gekozen varianten");
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
