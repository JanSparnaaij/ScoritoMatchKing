import { prisma } from "@/lib/prisma";

function isConfigured(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export async function getLocalStatus() {
  const latestSync = await prisma.syncJob.findFirst({
    orderBy: { syncedAt: "desc" },
  });

  return {
    mode: "local",
    keys: {
      apiFootball: isConfigured(process.env.API_FOOTBALL_KEY),
      oddsApi: isConfigured(process.env.ODDS_API_KEY),
      footballData: isConfigured(process.env.FOOTBALL_DATA_API_KEY),
    },
    externalSyncEnabled: process.env.ENABLE_EXTERNAL_SYNC === "true",
    latestSync: latestSync
      ? {
          roundCode: latestSync.roundCode,
          syncedAt: latestSync.syncedAt.toISOString(),
          matches: latestSync.matchesCount,
          players: latestSync.playersCount,
          predictions: latestSync.predictionsCount,
          source: latestSync.source,
        }
      : null,
  };
}

type ProviderProbe = {
  configured: boolean;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  message: string;
};

type ProbeResult = {
  testedAt: string;
  apiFootball: ProviderProbe;
  oddsApi: ProviderProbe;
  footballData: ProviderProbe;
};

export async function testApiConnections(): Promise<ProbeResult> {
  const [apiFootball, oddsApi, footballData] = await Promise.all([
    probeApiFootball(),
    probeOddsApi(),
    probeFootballData(),
  ]);

  return {
    testedAt: new Date().toISOString(),
    apiFootball,
    oddsApi,
    footballData,
  };
}

async function probeApiFootball(): Promise<ProviderProbe> {
  const key = process.env.API_FOOTBALL_KEY;
  const baseUrl = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

  if (!isConfigured(key)) {
    return notConfigured("API_FOOTBALL_KEY ontbreekt");
  }

  const safeKey = key as string;

  return runProbe(`${baseUrl}/timezone`, {
    headers: {
      "x-apisports-key": safeKey,
    },
  });
}

async function probeOddsApi(): Promise<ProviderProbe> {
  const key = process.env.ODDS_API_KEY;
  const baseUrl = process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com/v4";

  if (!isConfigured(key)) {
    return notConfigured("ODDS_API_KEY ontbreekt");
  }

  const safeKey = key as string;

  return runProbe(`${baseUrl}/sports/?apiKey=${encodeURIComponent(safeKey)}`);
}

async function probeFootballData(): Promise<ProviderProbe> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  const baseUrl = process.env.FOOTBALL_DATA_BASE_URL ?? "https://api.football-data.org/v4";

  if (!isConfigured(key)) {
    return notConfigured("FOOTBALL_DATA_API_KEY ontbreekt");
  }

  const safeKey = key as string;

  return runProbe(`${baseUrl}/competitions?limit=1`, {
    headers: {
      "X-Auth-Token": safeKey,
    },
  });
}

async function runProbe(
  url: string,
  init?: RequestInit,
): Promise<ProviderProbe> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      configured: true,
      ok: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - start,
      message: response.ok ? "OK" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : "Onbekende fout",
    };
  }
}

function notConfigured(message: string): ProviderProbe {
  return {
    configured: false,
    ok: false,
    statusCode: null,
    latencyMs: null,
    message,
  };
}
