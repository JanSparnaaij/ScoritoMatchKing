import { env } from "@/config/env";

async function main() {
  const queries = [
    "Eerste Divisie",
    "Keuken Kampioen Divisie",
    "Jupiler Pro League",
    "First Division A",
    "Pro League",
    "Eredivisie",
  ];

  for (const query of queries) {
    const response = await fetch(
      `${env.API_FOOTBALL_BASE_URL}/leagues?search=${encodeURIComponent(query)}`,
      {
        headers: {
          "x-apisports-key": env.API_FOOTBALL_KEY,
        },
      },
    );

    const payload = (await response.json()) as {
      response?: Array<{ league?: { id?: number; name?: string } }>;
    };

    const names = (payload.response ?? []).slice(0, 5).map((entry) => ({
      id: entry.league?.id,
      name: entry.league?.name,
    }));

    console.log(query, response.status, names);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
