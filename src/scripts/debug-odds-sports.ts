import { env } from "@/config/env";

async function main() {
  const response = await fetch(`${env.ODDS_API_BASE_URL}/sports?apiKey=${encodeURIComponent(env.ODDS_API_KEY)}`);
  const payload = (await response.json()) as Array<{ key: string; title: string; active: boolean }>;

  const filtered = payload.filter((entry) =>
    entry.key.includes("netherlands") || entry.title.toLowerCase().includes("nether"),
  );

  console.log(filtered);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
